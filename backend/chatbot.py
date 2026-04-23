def generate_response(user_query, ai_data):
    query = (user_query or "").lower()

    if "best time" in query:
        if ai_data.get("best_hour") is None:
            return "There is not enough data yet to estimate the best time."
        return f"Best time looks around {ai_data.get('best_hour')}:00."

    if "success rate" in query:
        return f"Current success rate is {ai_data.get('success_rate', 0)}%."

    if "when should i check" in query or "recommendation" in query:
        return ai_data.get("recommendation", "No recommendation available.")

    if "insight" in query:
        return ai_data.get("insight", "No insight available.")

    return "Ask about best time, success rate, recommendation, or insight."
