"""
Currency Converter - Exchange rate fetching and conversion. Task 16.1
"""

import logging
import time
from typing import Dict, Optional, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Static fallback rates (USD base)
FALLBACK_RATES: Dict[str, float] = {
    "USD": 1.0, "EUR": 0.92, "GBP": 0.79, "JPY": 149.5,
    "CAD": 1.36, "AUD": 1.53, "CHF": 0.89, "CNY": 7.24,
    "INR": 83.1, "BRL": 4.97, "MXN": 17.2, "SGD": 1.34,
    "HKD": 7.82, "NOK": 10.6, "SEK": 10.4, "DKK": 6.88,
    "NZD": 1.63, "ZAR": 18.6, "KRW": 1325.0, "AED": 3.67
}

CURRENCY_SYMBOLS: Dict[str, str] = {
    "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥",
    "CAD": "CA$", "AUD": "A$", "CHF": "Fr", "CNY": "¥",
    "INR": "₹", "BRL": "R$", "MXN": "MX$", "SGD": "S$",
    "HKD": "HK$", "NOK": "kr", "SEK": "kr", "DKK": "kr",
    "NZD": "NZ$", "ZAR": "R", "KRW": "₩", "AED": "د.إ"
}


class CurrencyConverter:
    """
    Fetches exchange rates and converts prices between currencies.
    Caches rates for 24 hours, falls back to static rates if API unavailable.
    """

    CACHE_TTL = 86400  # 24 hours

    def __init__(self):
        self._rates: Dict[str, float] = dict(FALLBACK_RATES)
        self._last_updated: Optional[float] = None
        self._is_fallback = True

    def get_rates(self) -> Dict[str, Any]:
        """Return current exchange rates with metadata."""
        return {
            "base": "USD",
            "rates": self._rates,
            "symbols": CURRENCY_SYMBOLS,
            "is_fallback": self._is_fallback,
            "updated_at": datetime.fromtimestamp(
                self._last_updated, tz=timezone.utc
            ).isoformat() if self._last_updated else None
        }

    def convert(self, amount: float, from_currency: str, to_currency: str) -> float:
        """Convert amount from one currency to another via USD."""
        if from_currency == to_currency:
            return amount

        # Convert to USD first
        from_rate = self._rates.get(from_currency.upper(), 1.0)
        to_rate = self._rates.get(to_currency.upper(), 1.0)

        usd_amount = amount / from_rate
        return usd_amount * to_rate

    def format_price(self, amount_usd: float, currency: str) -> str:
        """Format a USD price in the target currency."""
        converted = self.convert(amount_usd, "USD", currency)
        symbol = CURRENCY_SYMBOLS.get(currency.upper(), currency)
        return f"{symbol}{converted:.4f}"

    def get_supported_currencies(self) -> list:
        """Return list of supported currency codes."""
        return sorted(self._rates.keys())

    async def refresh_rates(self) -> bool:
        """
        Attempt to refresh rates from external API.
        Falls back to static rates on failure.
        """
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.exchangerate-api.com/v4/latest/USD"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    self._rates = data.get("rates", FALLBACK_RATES)
                    self._rates["USD"] = 1.0
                    self._last_updated = time.time()
                    self._is_fallback = False
                    logger.info("Exchange rates refreshed successfully")
                    return True
        except Exception as e:
            logger.warning(f"Failed to refresh exchange rates: {e}. Using fallback rates.")

        self._rates = dict(FALLBACK_RATES)
        self._last_updated = time.time()
        self._is_fallback = True
        return False


# Singleton instance
_converter = CurrencyConverter()


def get_converter() -> CurrencyConverter:
    return _converter
