def analyze_portal(checks):
    hours = []
    triggers = []

    for check in checks:
        hour = int(check.checked_at.strftime("%H"))
        hours.append(hour)
        if check.is_triggered:
            triggers.append(hour)

    if not hours:
        return {
            "best_hour": None,
            "success_rate": 0,
            "recommendation": "No data yet",
            "insight": "Need more data"
        }

    best_hour = max(set(triggers), key=triggers.count) if triggers else None
    success_rate = round((len(triggers) / len(hours)) * 100, 2) if hours else 0

    if best_hour is not None:
        recommendation = f"High chance around {best_hour}:00"
    else:
        recommendation = "No strong pattern yet"

    if success_rate > 50:
        insight = "High opportunity portal"
    elif success_rate > 20:
        insight = "Moderate opportunity portal"
    else:
        insight = "Low opportunity portal"

    return {
        "best_hour": best_hour,
        "success_rate": success_rate,
        "recommendation": recommendation,
        "insight": insight
    }
