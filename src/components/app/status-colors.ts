import type { StatusColor } from "./status-badge";

export function ruleStatusColor(status: string): StatusColor {
  switch (status) {
    case "active":
      return "green";
    case "draft":
    case "pending_guidance":
      return "yellow";
    case "manual_review_required":
      return "purple";
    case "replaced":
    case "repealed":
    case "archived":
      return "gray";
    default:
      return "gray";
  }
}

export function coverageColor(coverage: string): StatusColor {
  switch (coverage) {
    case "fully_supported":
      return "green";
    case "partially_supported":
      return "yellow";
    case "requires_manual_review":
      return "purple";
    case "pending_regulatory_guidance":
      return "blue";
    case "unsupported":
      return "red";
    default:
      return "gray";
  }
}
