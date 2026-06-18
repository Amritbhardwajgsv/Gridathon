import re

from app.schemas import ImpactPredictionRequest, NlpSignal

RISK_KEYWORDS = {
    "crowd": ["crowd", "gathering", "rally", "procession", "festival", "match"],
    "blockage": ["blocked", "block", "stuck", "jam", "closure", "barricade"],
    "safety": ["ambulance", "emergency", "stampede", "injury", "accident", "fire"],
    "public_transport": ["bus", "metro", "school", "hospital", "airport"],
    "vip": ["vip", "vvip", "minister", "convoy"],
}


class NlpAgentService:
    def analyze(self, payload: ImpactPredictionRequest) -> NlpSignal:
        text = self._event_text(payload)
        if not text:
            return NlpSignal(
                summary="No operational description provided.",
                keywords=[],
                urgency_score=self._base_urgency(payload),
                detected_risks=[],
                agent_used="rules_fallback",
            )

        return self._langchain_or_rules(text, payload)

    def _langchain_or_rules(
        self, text: str, payload: ImpactPredictionRequest
    ) -> NlpSignal:
        try:
            from langchain_core.prompts import PromptTemplate
            from langchain_core.runnables import RunnableLambda

            prompt = PromptTemplate.from_template(
                "Summarise this Bengaluru traffic event for police triage: {text}"
            )
            chain = prompt | RunnableLambda(
                lambda value: self._rules(value.to_string(), payload)
            )
            signal = chain.invoke({"text": text})
            signal.agent_used = "langchain_rules_agent"
            return signal
        except Exception:
            return self._rules(text, payload)

    def _rules(self, text: str, payload: ImpactPredictionRequest) -> NlpSignal:
        normalized = text.lower()
        words = re.findall(r"[a-zA-Z0-9]+", normalized)
        keyword_hits: list[str] = []
        risks: list[str] = []

        for risk, keywords in RISK_KEYWORDS.items():
            hits = [keyword for keyword in keywords if keyword in normalized]
            if hits:
                risks.append(risk)
                keyword_hits.extend(hits)

        urgency = self._base_urgency(payload)
        urgency += min(30, len(set(keyword_hits)) * 5)
        if payload.estimated_crowd_size:
            urgency += min(20, payload.estimated_crowd_size // 5000)
        urgency = min(100, urgency)

        summary_words = words[:28]
        summary = " ".join(summary_words)
        if summary:
            summary = summary[0].upper() + summary[1:]

        return NlpSignal(
            summary=summary or "Operational description processed.",
            keywords=sorted(set(keyword_hits))[:12],
            urgency_score=urgency,
            detected_risks=risks,
            agent_used="rules_fallback",
        )

    @staticmethod
    def _base_urgency(payload: ImpactPredictionRequest) -> int:
        score = {
            "Low": 20,
            "Medium": 40,
            "High": 65,
            "Critical": 85,
        }.get(payload.priority, 45)
        if payload.requires_road_closure:
            score += 10
        return min(100, score)

    @staticmethod
    def _event_text(payload: ImpactPredictionRequest) -> str:
        return " ".join(
            part
            for part in [
                payload.event_name,
                payload.event_cause_grouped,
                payload.corridor,
                payload.zone,
                payload.operational_description,
            ]
            if part
        )


nlp_agent_service = NlpAgentService()
