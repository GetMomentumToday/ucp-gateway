# Local E-Commerce Platforms

Docker Compose setup for running Magento 2 and Shopware 6 locally for adapter development and testing.

## Quick Start

```bash
# Start all platforms (first boot: ~5 min Magento, ~2 min Shopware)
docker compose -f platforms/docker-compose.platforms.yml up -d

# Watch startup progress
docker compose -f platforms/docker-compose.platforms.yml logs -f

# Wait for health checks to pass
docker compose -f platforms/docker-compose.platforms.yml ps

# Seed sample products
bash platforms/magento/setup-products.sh
bash platforms/shopware/setup-products.sh
```

## Endpoints

| Platform | Store | Admin | API |
|---|---|---|---|
| **Magento 2** | http://localhost:8080 | http://localhost:8080/admin | http://localhost:8080/rest/V1/ |
| **Shopware 6** | http://localhost:8888 | http://localhost:8888/admin | http://localhost:8888/api/ |

## Credentials

| Platform | Username | Password |
|---|---|---|
| Magento 2 Admin | `admin` | `magentorocks1` |
| Shopware 6 Admin | `admin` | `shopware` |

## Sample Products

Both platforms are seeded with the same 5 products (matching `MockAdapter`):

| SKU | Name | Price |
|---|---|---|
| UCP-SHOES-001 | Running Shoes Pro | $129.99 |
| UCP-SNEAKERS-002 | Casual Sneakers | $79.99 |
| UCP-BOOTS-003 | Hiking Boots | $189.99 |
| UCP-LOAFERS-004 | Leather Loafers | $249.99 |
| UCP-SANDALS-005 | Sport Sandals | $49.99 |

## API Authentication

### Magento 2 — Bearer Token

```bash
# Get admin token
TOKEN=$(curl -s -X POST http://localhost:8080/rest/V1/integration/admin/token \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"magentorocks1"}' | tr -d '"')

# Use token
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/rest/V1/products?searchCriteria[pageSize]=5
```

### Shopware 6 — OAuth2

```bash
# Get access token
TOKEN=$(curl -s -X POST http://localhost:8888/api/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"password","client_id":"administration","username":"admin","password":"shopware"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Use token (Admin API)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8888/api/product

# Store API (uses sw-access-key header, no auth needed for read)
curl -H "sw-access-key: SWSC..." http://localhost:8888/store-api/product
```

## Tear Down

```bash
# Stop containers
docker compose -f platforms/docker-compose.platforms.yml down

# Stop and delete all data
docker compose -f platforms/docker-compose.platforms.yml down -v
```

## Resource Usage

| Service | RAM | Disk |
|---|---|---|
| Magento 2 | ~1.5 GB | ~2 GB |
| MariaDB | ~256 MB | ~500 MB |
| Elasticsearch | ~512 MB | ~200 MB |
| Shopware 6 | ~512 MB | ~1 GB |
| **Total** | **~2.8 GB** | **~3.7 GB** |
