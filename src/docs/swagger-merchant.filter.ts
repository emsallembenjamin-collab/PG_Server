import { OpenAPIObject } from "@nestjs/swagger";
import type {
  PathItemObject,
  OperationObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/** Operations tagged with this appear in the Merchant API Swagger UI (`/api/docs/merchant`). */
export const MERCHANT_INTEGRATION_TAG = "Merchant Integration";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);

/**
 * Keeps only path operations that include the given OpenAPI tag (e.g. merchant-only docs).
 */
export function filterOpenApiByTag(
  doc: OpenAPIObject,
  tag: string,
): OpenAPIObject {
  const newPaths: OpenAPIObject["paths"] = {};

  for (const [path, pathItem] of Object.entries(doc.paths || {})) {
    if (!pathItem) {
      continue;
    }
    const newPathItem: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(pathItem)) {
      if (HTTP_METHODS.has(key)) {
        const op = value as OperationObject;
        if (op?.tags?.includes(tag)) {
          newPathItem[key] = value;
        }
      }
    }

    if (Object.keys(newPathItem).length > 0) {
      newPaths[path] = newPathItem as PathItemObject;
    }
  }

  const usedTags = new Set<string>();
  for (const pathItem of Object.values(newPaths)) {
    if (!pathItem) {
      continue;
    }
    for (const [key, value] of Object.entries(pathItem)) {
      if (HTTP_METHODS.has(key)) {
        const op = value as OperationObject;
        op.tags?.forEach((t) => usedTags.add(t));
      }
    }
  }

  const filteredDocTags = (doc.tags || []).filter((t) =>
    usedTags.has(t.name),
  );

  return {
    ...doc,
    paths: newPaths,
    tags: filteredDocTags,
  };
}
