# Multi-Cloud Cost Intelligence Platform — User Guide
> Task 22.2

## Overview

The Multi-Cloud Cost Intelligence Platform lets you compare cloud services across AWS, Azure, GCP and more — with real-time pricing, AI-powered optimization suggestions, and interactive cost estimation.

---

## Getting Started

### 1. Select Cloud Providers

On the left sidebar, click the **Select Cloud Providers** panel.

- Click any provider card to select it (it highlights with the provider's brand color)
- The health indicator (✅ / ⚠️ / ❌) shows whether the provider API is reachable
- Use **Select All** to enable all providers at once

> **Tip:** Start with 2–3 providers for the clearest comparison.

---

### 2. Filter by Region

After selecting providers, the **Select Regions** panel populates with available regions.

- Use the search box to find a specific region (e.g. `us-east-1`)
- Click **🇺🇸 US Regions**, **🇪🇺 EU Regions**, or **🌏 Asia Regions** for quick selection
- Leave all regions unselected to see services from all regions

---

### 3. Filter by Category

Use the **Filter by Category** panel to narrow down service types:

| Category | Examples |
|----------|---------|
| Compute (VMs) | EC2, Azure VM, Compute Engine |
| Object Storage | S3, Blob Storage, Cloud Storage |
| Relational Database | RDS, Azure SQL, Cloud SQL |
| Managed Kubernetes | EKS, AKS, GKE |
| Serverless Functions | Lambda, Azure Functions, Cloud Run |

Click **Popular** to select the most commonly compared categories.

---

### 4. Browse the Service Catalog

The main panel shows all matching services as cards.

- **Grid view** (default): Shows specs and pricing at a glance
- **List view**: More compact, good for large datasets
- **Sort** by Price, Name, or Provider using the dropdown
- Click **View Details** on any card to see additional metadata

Each card shows:
- Provider logo and name
- Service name and category
- Price per unit (e.g. `$0.0416/hour`)
- Estimated monthly cost
- Specs (vCPU, memory, storage)
- Pricing tier (On-Demand, Reserved, Spot)

---

### 5. Search Services

Use the **search bar** at the top to find specific services:

- Type at least 2 characters to see autocomplete suggestions
- Suggestions include service names and categories
- Recent searches are saved for quick access
- Press **Escape** to close the dropdown

---

### 6. Compare Services

Switch to the **Compare** tab to see a side-by-side comparison.

Services are added to comparison from the catalog (click the compare button on a card).

The comparison table shows:
- Price for each service
- Price difference vs. the cheapest option (in $ and %)
- The cheapest option is highlighted with a 🏆 badge
- A bar chart visualizes the price differences

Click **Export** to download the comparison as CSV.

---

### 7. Estimate Costs

Switch to the **Cost Estimator** tab to calculate your expected monthly bill.

Enter your usage parameters:
- **Compute Hours/Month** — how many hours your instances run (730 = 24/7)
- **Storage (GB)** — total storage needed
- **Network Egress (GB)** — outbound data transfer
- **API Calls/Month** — for serverless/API services

Select a duration (hourly / daily / monthly / annual) and click **Calculate Cost**.

Results show:
- Cost breakdown by provider
- Cost breakdown by category
- Total estimated spend

---

### 8. AI Optimization Suggestions

The right panel (or click **Analyze Costs** in the header) runs AI analysis on your selected services.

Suggestion types:
| Type | Description |
|------|-------------|
| Reserved Instances | Save ~35% by committing to 1-year terms |
| Spot Instances | Save ~70% for fault-tolerant workloads |
| Cross-Provider Migration | Switch providers to save >$50/month |
| Right-Sizing | Downsize over-provisioned resources |

Each card shows:
- Current vs. optimized monthly cost
- Estimated savings (monthly and annual)
- Step-by-step action plan
- Confidence level (High / Medium / Low)

Click **Implement** to mark a suggestion as actioned, or **✕** to dismiss it.

---

### 9. Export Data

Click the **Export** button in the header to download the current service catalog as CSV.

The comparison panel also has its own export button for comparison-specific data.

---

### 10. Share a Comparison

Click the **Share** button to generate a shareable link.

- The link is copied to your clipboard automatically
- Links expire after 30 days
- Anyone with the link can view the same comparison state

---

### 11. Currency Conversion

Click the currency selector (default: **USD**) in the header to switch display currency.

Supported currencies: USD, EUR, GBP, JPY, CAD, AUD, INR, BRL, CNY, SGD, CHF, KRW

Your selection is saved and persists across sessions.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Move between interactive elements |
| `Enter` / `Space` | Activate buttons and checkboxes |
| `Escape` | Close dropdowns and modals |
| `↑` / `↓` | Navigate lists |
| `Home` / `End` | Jump to first/last item in a list |

---

## Troubleshooting

**Services not loading?**
- Check that at least one provider is selected
- Click the **Refresh** button (↻) to clear the cache
- Check provider health status in the provider selector

**Prices seem outdated?**
- Click **Refresh** to force a fresh fetch from provider APIs
- Prices are cached for 6 hours by default

**Optimization panel is empty?**
- Click **Analyze** to run the analysis
- Make sure at least one provider with compute services is selected

**Export not working?**
- Check your browser's download permissions
- Try a smaller selection (fewer providers/categories)
