from uuid import UUID, uuid4

from sqlmodel import Field, UniqueConstraint
from .base import TimestampMixin


class EntityTranslation(TimestampMixin, table=True):
    __tablename__ = "entity_translations" # type: ignore
    __table_args__ = (
        UniqueConstraint(
            "translatable_type",
            "translatable_id",
            "locale",
            "field_name",
            name="uq_entity_translation_field",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Polymorphic linking configuration
    translatable_type: str = Field(
        max_length=100, index=True, nullable=False
    )  # e.g., 'Product'
    translatable_id: UUID = Field(index=True, nullable=False)

    locale: str = Field(
        max_length=5, index=True, nullable=False
    )  # e.g., 'fr', 'de', 'en'
    field_name: str = Field(
        max_length=100, nullable=False
    )  # e.g., 'title', 'description'
    translation_text: str = Field(nullable=False)

    def model_validator(self) -> "EntityTranslation":
        self.locale = self.locale.lower()
        return self
