import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn.compose._column_transformer as sklearn_column_transformer

from app.schemas import ImpactPredictionRequest, ImpactPredictionResponse
from app.services.nlp_agent_service import nlp_agent_service
from app.services.operational_policy import model_input_dict
from app.services.resource_recommendation_service import resource_recommendation_service


class PredictionError(Exception):
    """Raised when model loading or inference fails."""


class PredictionService:
    def __init__(
        self,
        models_dir: Path | None = None,
        model_version: str = "v1",
    ) -> None:
        self.models_dir = models_dir or Path(__file__).resolve().parents[1] / "models"
        self.model_version = model_version
        self.duration_model: Any | None = None
        self.impact_model: Any | None = None
        self.duration_feature_columns: list[str] = []
        self.impact_feature_columns: list[str] = []

    @property
    def is_ready(self) -> bool:
        return self.duration_model is not None and self.impact_model is not None

    def load_models(self) -> None:
        try:
            self._patch_sklearn_pickle_compatibility()
            self.duration_model = joblib.load(self.models_dir / "duration_model.pkl")
            self.impact_model = joblib.load(self.models_dir / "impact_model.pkl")
            self.duration_feature_columns = self._load_feature_columns(
                "duration_feature_columns.json"
            )
            self.impact_feature_columns = self._load_feature_columns(
                "impact_feature_columns.json"
            )
            self._repair_passthrough_columns(
                self.duration_model, self.duration_feature_columns
            )
            self._repair_passthrough_columns(self.impact_model, self.impact_feature_columns)
        except Exception as exc:
            raise PredictionError(f"Failed to load prediction models: {exc}") from exc

    def predict(
        self, payload: ImpactPredictionRequest
    ) -> ImpactPredictionResponse:
        if not self.is_ready:
            raise PredictionError("Prediction models are not loaded")

        input_data = model_input_dict(payload)

        try:
            duration_df = self._build_feature_frame(
                input_data, self.duration_feature_columns
            )
            impact_df = self._build_feature_frame(input_data, self.impact_feature_columns)

            predicted_log_duration = self.duration_model.predict(duration_df)[0]
            predicted_duration_minutes = round(
                float(np.expm1(predicted_log_duration)), 2
            )

            predicted_impact = self.impact_model.predict(impact_df)[0]

            base_response = ImpactPredictionResponse(
                predicted_duration_minutes=predicted_duration_minutes,
                impact_level=str(predicted_impact),
                model_version=self.model_version,
            )
            nlp_signal = nlp_agent_service.analyze(payload)
            resource_recommendation, learning_signal = resource_recommendation_service.build(
                payload,
                base_response,
                nlp_signal,
            )

            base_response.nlp_signal = nlp_signal
            base_response.resource_recommendation = resource_recommendation
            base_response.learning_signal = learning_signal
            return base_response
        except Exception as exc:
            raise PredictionError(f"Prediction failed: {exc}") from exc

    def _load_feature_columns(self, filename: str) -> list[str]:
        columns_path = self.models_dir / filename
        with columns_path.open("r", encoding="utf-8") as file:
            columns = json.load(file)

        if not isinstance(columns, list) or not all(
            isinstance(column, str) for column in columns
        ):
            raise PredictionError(f"Invalid feature columns file: {columns_path}")

        return columns

    @staticmethod
    def _patch_sklearn_pickle_compatibility() -> None:
        if hasattr(sklearn_column_transformer, "_RemainderColsList"):
            return

        class _RemainderColsList(list):
            pass

        sklearn_column_transformer._RemainderColsList = _RemainderColsList

    @staticmethod
    def _repair_passthrough_columns(model: Any, feature_columns: list[str]) -> None:
        if not hasattr(model, "steps"):
            return

        preprocessor = model.steps[0][1]
        if not hasattr(preprocessor, "transformers_"):
            return

        categorical_columns = set()
        for name, _transformer, columns in preprocessor.transformers_:
            if name != "remainder":
                categorical_columns.update(columns)

        remainder_columns = [
            column for column in feature_columns if column not in categorical_columns
        ]
        repaired_transformers = []

        for name, transformer, columns in preprocessor.transformers_:
            if name == "remainder" and columns == [] and remainder_columns:
                repaired_transformers.append((name, transformer, remainder_columns))
                preprocessor._remainder = (name, preprocessor.remainder, remainder_columns)
            else:
                repaired_transformers.append((name, transformer, columns))

        preprocessor.transformers_ = repaired_transformers

    @staticmethod
    def _build_feature_frame(
        input_data: dict[str, Any], feature_columns: list[str]
    ) -> pd.DataFrame:
        missing_columns = [
            column for column in feature_columns if column not in input_data
        ]
        if missing_columns:
            joined_columns = ", ".join(missing_columns)
            raise PredictionError(f"Missing feature columns: {joined_columns}")

        return pd.DataFrame([{column: input_data[column] for column in feature_columns}])
