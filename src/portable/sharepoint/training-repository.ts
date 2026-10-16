import { z } from "zod";
import type { GraphClient } from "@/portable/graph/graph-client";

export const portableTrainingInputSchema = z.object({
  code: z.string().trim().min(1).max(80),
  year: z.number().int().min(2000).max(2100),
  name: z.string().trim().min(1).max(300),
  planningType: z.enum(["PLANNED", "UNPLANNED"]),
  reason: z.string().trim().max(1000).optional(),
  isGmp: z.boolean(),
  originType: z.enum(["INTERNAL", "EXTERNAL"]),
}).superRefine((value, context) => {
  if (value.planningType === "UNPLANNED" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "El motivo es obligatorio para una formación no planificada" });
  }
});

export type PortableTrainingInput = z.infer<typeof portableTrainingInputSchema>;
export type PortableTraining = PortableTrainingInput & {
  id: string;
  eTag: string;
  updatedAt?: string;
};

type GraphListItem = {
  id: string;
  eTag?: string;
  lastModifiedDateTime?: string;
  fields?: Record<string, unknown> & { "@odata.etag"?: string };
};

type GraphTransport = Pick<GraphClient, "requestJson" | "paginate">;

function segment(value: string) {
  return encodeURIComponent(value);
}

function jsonBody(value: unknown) {
  return {
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" },
  };
}

function toFields(input: PortableTrainingInput) {
  return {
    Title: input.name,
    CovexCode: input.code,
    CovexYear: input.year,
    PlanningType: input.planningType,
    Reason: input.reason ?? "",
    IsGmp: input.isGmp,
    OriginType: input.originType,
  };
}

function fromItem(item: GraphListItem): PortableTraining {
  const fields = item.fields ?? {};
  const parsed = portableTrainingInputSchema.safeParse({
    code: fields.CovexCode,
    year: Number(fields.CovexYear),
    name: fields.Title,
    planningType: fields.PlanningType,
    reason: typeof fields.Reason === "string" && fields.Reason.trim() ? fields.Reason : undefined,
    isGmp: fields.IsGmp,
    originType: fields.OriginType,
  });
  const eTag = item.eTag ?? fields["@odata.etag"];
  if (!parsed.success || typeof item.id !== "string" || typeof eTag !== "string") {
    throw new Error("SharePoint devolvió una Formación con campos o ETag no válidos.");
  }
  return { id: item.id, eTag, updatedAt: item.lastModifiedDateTime, ...parsed.data };
}

export class SharePointTrainingRepository {
  private readonly itemsPath: string;

  constructor(
    private readonly graph: GraphTransport,
    siteId: string,
    listId: string,
  ) {
    this.itemsPath = `/sites/${segment(siteId)}/lists/${segment(listId)}/items`;
  }

  async list() {
    const items = await this.graph.paginate<GraphListItem>(`${this.itemsPath}?expand=fields`);
    return items.map(fromItem);
  }

  async findById(id: string) {
    const item = await this.graph.requestJson<GraphListItem>(`${this.itemsPath}/${segment(id)}?expand=fields`);
    return fromItem(item);
  }

  async create(input: PortableTrainingInput) {
    const validated = portableTrainingInputSchema.parse(input);
    const item = await this.graph.requestJson<GraphListItem>(this.itemsPath, {
      method: "POST",
      ...jsonBody({ fields: toFields(validated) }),
    });
    return fromItem(item);
  }

  async update(id: string, input: PortableTrainingInput, eTag: string) {
    if (!eTag.trim() || eTag === "*") throw new Error("Se requiere el ETag leído antes de modificar la Formación.");
    const validated = portableTrainingInputSchema.parse(input);
    await this.graph.requestJson<Record<string, unknown>>(`${this.itemsPath}/${segment(id)}/fields`, {
      method: "PATCH",
      ...jsonBody(toFields(validated)),
      headers: { "Content-Type": "application/json", "If-Match": eTag },
    });
    return this.findById(id);
  }
}
