<?php

declare(strict_types=1);

/**
 * Iris PHP Client — single file, zero dependencies.
 * Drop this into any PHP project and start publishing events.
 *
 * @see iris.md for full integration guide
 */
class Iris
{
    private string $token;
    private string $gatewayUrl;
    private int $timeoutSeconds;

    public function __construct(
        string $token = '',
        string $gatewayUrl = 'http://localhost:3001/',
        int $timeoutSeconds = 5,
    ) {
        // @rizkydaffy: resolve from env if not passed explicitly
        $this->token = $token ?: ($_ENV['IRIS_PROJECT_TOKEN'] ?? getenv('IRIS_PROJECT_TOKEN') ?: '');
        if ($this->token === '') {
            throw new \RuntimeException('Iris: IRIS_PROJECT_TOKEN is required');
        }
        $this->gatewayUrl = rtrim($gatewayUrl ?: ($_ENV['IRIS_GATEWAY_URL'] ?? getenv('IRIS_GATEWAY_URL') ?: 'http://localhost:3001/'), '/');
        $this->timeoutSeconds = $timeoutSeconds;
    }

    /**
     * Verify the token against the gateway. Throws on invalid token.
     * Call once at app startup.
     *
     * @return array{id: string, name: string, isActive: bool}
     */
    public function init(): array
    {
        $response = $this->request('GET', '/ingress/whoami');
        if ($response['status'] === 401) {
            throw new \RuntimeException('Iris: invalid token — check IRIS_PROJECT_TOKEN');
        }
        if ($response['status'] !== 200) {
            throw new \RuntimeException("Iris: whoami failed with status {$response['status']}");
        }
        return $response['body'];
    }

    /**
     * Register routes with the portal. Replaces the full route set (idempotent).
     *
     * $routes: array of ['path' => '/api/foo', 'method' => 'GET', 'description' => '...']
     * OR pass a Laravel RouteCollection directly — it will be normalised.
     *
     * @param array|\Illuminate\Routing\RouteCollection $routes
     */
    public function syncRoutes(array|\Illuminate\Routing\RouteCollection $routes): void
    {
        if ($routes instanceof \Illuminate\Routing\RouteCollection) {
            $routes = $this->normaliseLaravelRoutes($routes);
        }

        $this->request('POST', '/ingress/register', $routes);
    }

    /**
     * Publish a durable event. Returns immediately — delivery is async.
     *
     * @param string $event   Event name, e.g. 'order_placed'
     * @param mixed  $data    Any JSON-serialisable payload
     * @param string $idempotencyKey Optional — auto-generated if omitted
     */
    public function publish(string $event, mixed $data = [], string $idempotencyKey = ''): void
    {
        $payload = ['event' => $event, 'data' => $data];
        if ($idempotencyKey !== '') {
            $payload['idempotencyKey'] = $idempotencyKey;
        }
        $this->request('POST', '/ingress/publish', $payload);
    }

    // -- private --

    /** @return array{status: int, body: mixed} */
    private function request(string $method, string $path, mixed $body = null): array
    {
        $url = $this->gatewayUrl . $path;
        $headers = [
            'Authorization: Bearer ' . $this->token,
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => $method,
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
        }

        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error !== '') {
            throw new \RuntimeException("Iris: request to {$path} failed — {$error}");
        }

        /** @var mixed $decoded */
        $decoded = $raw ? json_decode($raw, true) : null;
        return ['status' => $status, 'body' => $decoded];
    }

    /** Normalise Laravel RouteCollection into the RouteSchema[] format. */
    private function normaliseLaravelRoutes(\Illuminate\Routing\RouteCollection $collection): array
    {
        $routes = [];
        $seen = [];

        foreach ($collection as $route) {
            $uri = '/' . ltrim($route->uri(), '/');
            // Skip internal Laravel/debug routes
            if (str_starts_with($uri, '/_') || str_starts_with($uri, '/telescope') || str_starts_with($uri, '/horizon')) {
                continue;
            }
            foreach ($route->methods() as $method) {
                if ($method === 'HEAD')
                    continue;
                $key = $method . ':' . $uri;
                if (isset($seen[$key]))
                    continue;
                $seen[$key] = true;
                $entry = ['path' => $uri, 'method' => $method];
                // Include route name as description if available
                if ($name = $route->getName()) {
                    $entry['description'] = $name;
                }
                $routes[] = $entry;
            }
        }

        return $routes;
    }
}
