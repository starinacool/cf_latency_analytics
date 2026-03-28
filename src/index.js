export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API Endpoint for Latency Analytics
    if (url.pathname === "/api/latency") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleLatencyRequest(request, env);
    }

    // Default to serving assets from the directory specified in wrangler.toml
    return env.ASSETS.fetch(request);
  }
};

async function handleLatencyRequest(request, env) {
  try {
    const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } = env;

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
      return new Response(JSON.stringify({
        error: "Missing Cloudflare API Token or Zone ID. Please set them as secrets."
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json();
    const { timeframe, prefix, excludePrefix, host, cacheStatus, interval, colo, country, method, groupByPath } = body;

    // Determine time range
    const now = new Date();
    let after;
    let step; // for grouping
    let needsManualAggregation = false;

    // 1. Determine timeframe (if interval not explicitly set to a larger value)
    switch (timeframe) {
      case "day":
        after = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        after = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        after = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        after = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // 2. Determine interval (grouping step)
    if (interval) {
      switch (interval) {
        case "5m":
          step = "datetimeFiveMinutes";
          break;
        case "15m":
          step = "datetimeFifteenMinutes";
          break;
        case "1h":
          step = "datetimeHour";
          break;
        case "3h":
          step = "datetimeHour";
          needsManualAggregation = true;
          break;
        case "1d":
          step = "date";
          break;
        default:
          step = "datetimeHour";
      }
    } else {
      // Automatic defaults
      switch (timeframe) {
        case "day": step = "datetimeHour"; break;
        case "week": step = "datetimeHour"; break;
        case "month": step = "date"; break;
        default: step = "datetimeHour";
      }
    }

    const afterStr = after.toISOString().split('.')[0] + 'Z';
    const prefixStr = prefix ? `${prefix}` : "%";

    // Build filter objects dynamically
    const mainFilter = {
      datetime_geq: afterStr,
      clientRequestPath_like: prefixStr
    };
    if (excludePrefix) mainFilter.clientRequestPath_notlike = `${excludePrefix}`;
    if (host) mainFilter.clientRequestHTTPHost = host;
    if (cacheStatus) mainFilter.cacheStatus = cacheStatus;
    if (colo) mainFilter.coloCode = colo;
    if (country) mainFilter.clientCountryName = country;
    if (method) mainFilter.clientRequestHTTPMethodName = method;

    const discoveryFilter = {
      datetime_geq: afterStr,
      clientRequestPath_like: prefixStr
    };

    const dimensionFields = groupByPath ? `\n                ${step}\n                clientRequestPath\n              ` : `\n                ${step}\n              `;

    const query = `
      query GetLatency($zoneTag: String!, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject!, $discoveryFilter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequestsAdaptiveGroups(
              limit: 10000
              filter: $filter
              orderBy: [${step}_ASC]
            ) {
              count
              dimensions {${dimensionFields}}
              avg {
                edgeTimeToFirstByteMs
              }
              quantiles {
                edgeTimeToFirstByteMsP90
                originResponseDurationMsP90
              }
            }
            # Discovery query for unique cache statuses
            discovery: httpRequestsAdaptiveGroups(
              limit: 1000
              filter: $discoveryFilter
            ) {
              dimensions {
                cacheStatus
              }
            }
          }
        }
      }
    `;

    const variables = {
      zoneTag: CLOUDFLARE_ZONE_ID,
      filter: mainFilter,
      discoveryFilter: discoveryFilter
    };

    console.log("GraphQL Query:", query);
    console.log("GraphQL Variables:", JSON.stringify(variables, null, 2));

    const cfResponse = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, variables })
    });

    let data = await cfResponse.json();

    // 3. Handle manual aggregation for 3h interval
    if (needsManualAggregation && data.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups) {
      const originalGroups = data.data.viewer.zones[0].httpRequestsAdaptiveGroups;
      const aggregatedGroups = [];

      if (groupByPath) {
        const pathGroups = {};
        for (const group of originalGroups) {
          const path = group.dimensions.clientRequestPath || 'unknown';
          if (!pathGroups[path]) pathGroups[path] = [];
          pathGroups[path].push(group);
        }

        for (const path in pathGroups) {
          const pathChunks = pathGroups[path];
          for (let i = 0; i < pathChunks.length; i += 3) {
            const chunk = pathChunks.slice(i, i + 3);
            if (chunk.length === 0) continue;

            const first = chunk[0];
            const avg = (arr, key) => arr.reduce((acc, curr) => acc + (curr.quantiles[key] || 0), 0) / arr.length;
            const sum = (arr) => arr.reduce((acc, curr) => acc + (curr.count || 0), 0);

            aggregatedGroups.push({
              count: sum(chunk),
              dimensions: {
                datetimeHour: first.dimensions.datetimeHour,
                cacheStatus: first.dimensions.cacheStatus,
                clientRequestPath: first.dimensions.clientRequestPath
              },
              quantiles: {
                edgeTimeToFirstByteMsP90: Math.round(avg(chunk, 'edgeTimeToFirstByteMsP90')),
                originResponseDurationMsP90: Math.round(avg(chunk, 'originResponseDurationMsP90'))
              }
            });
          }
        }
      } else {
        for (let i = 0; i < originalGroups.length; i += 3) {
          const chunk = originalGroups.slice(i, i + 3);
          if (chunk.length === 0) continue;

          const first = chunk[0];
          const avg = (arr, key) => arr.reduce((acc, curr) => acc + (curr.quantiles[key] || 0), 0) / arr.length;
          const sum = (arr) => arr.reduce((acc, curr) => acc + (curr.count || 0), 0);

          aggregatedGroups.push({
            count: sum(chunk),
            dimensions: {
              datetimeHour: first.dimensions.datetimeHour,
              cacheStatus: first.dimensions.cacheStatus
            },
            quantiles: {
              edgeTimeToFirstByteMsP90: Math.round(avg(chunk, 'edgeTimeToFirstByteMsP90')),
              originResponseDurationMsP90: Math.round(avg(chunk, 'originResponseDurationMsP90'))
            }
          });
        }
      }
      data.data.viewer.zones[0].httpRequestsAdaptiveGroups = aggregatedGroups;
    }

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
