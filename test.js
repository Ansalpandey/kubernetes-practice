import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

// Custom metrics to track pod distribution (if your app returns hostname/pod name) & failure rates
const errorRate = new Rate("errors");
const podHits = new Counter("pod_hits");

export const options = {
  // CRITICAL FOR K8S L4 LOADBALANCER TESTING:
  // Forces a new TCP handshake per request so kube-proxy distributes traffic across all pods
  noConnectionReuse: true,

  stages: [
    { duration: "15s", target: 50 }, // Warm-up: ramp to 50 VUs
    { duration: "30s", target: 200 }, // Normal load: 200 VUs
    { duration: "45s", target: 500 }, // Stress spike: push pods & Minikube tunnel
    { duration: "20s", target: 0 }, // Cool-down
  ],

  thresholds: {
    http_req_duration: ["p(95)<300", "p(99)<800"], // 95% of requests under 300ms
    errors: ["rate<0.01"], // Less than 1% failed requests
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://192.168.39.162:31728";

export default function () {
  const params = {
    headers: {
      Connection: "close",
      Accept: "application/json",
    },
    timeout: "5s",
  };

  const res = http.get(`${BASE_URL}/`, params);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  errorRate.add(!ok);

  // Optional: If your Express app returns { pod: os.hostname() } or an X-Pod-Name header,
  // this counts hits per pod in the final summary.
  try {
    const body = res.json();
    if (body && (body.pod || body.hostname)) {
      podHits.add(1, { pod: body.pod || body.hostname });
    }
  } catch (_) {
    // Ignore non-JSON responses
  }

  sleep(0.1);
}
