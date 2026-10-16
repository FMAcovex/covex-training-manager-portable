import type { TrainerRepository } from "@/server/trainer-repository";

export class TrainerSelectionError extends Error {}

export async function validateQualifiedTrainerSelection(
  trainerRepository: TrainerRepository,
  trainerPersonIds: string[],
  allowManualOnly: boolean,
  previousTrainerPersonIds?: string[],
) {
  const ids = [...new Set(trainerPersonIds.filter(Boolean))];
  const previous = new Set(previousTrainerPersonIds ?? []);
  if (ids.length === 0) {
    if (allowManualOnly) return;
    if (previousTrainerPersonIds !== undefined && previous.size === 0) return;
    throw new TrainerSelectionError("Debe seleccionar al menos un formador cualificado");
  }
  const current = await trainerRepository.list({ currentOnly: true });
  const eligible = new Set(current.filter((item) => item.person.active).map((item) => item.personId));
  const invalid = ids.filter((id) => !previous.has(id) && !eligible.has(id));
  if (invalid.length) {
    throw new TrainerSelectionError("Los nuevos formadores seleccionados deben figurar con una cualificación vigente");
  }
}
