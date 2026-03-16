import { create } from "xmlbuilder2";

import type { TemplatePaperStock } from "@/lib/templates";

// UnitsPerInch="25.4" on the root JDF element sets 1 unit = 1mm.
// Dimension values can then be passed directly as mm numbers — readable by operators and Prinect.
function fmtMm(mm: number): string {
  return mm.toFixed(4);
}

export type JdfContact = {
  company?: string | null;
  personName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  region?: string | null;
};

export type DeliveryAddress = {
  companyName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  addressExtra?: string;
};

export type BuildJdfParams = {
  referenceCode: string;
  templateKey: string;
  pcmCode?: string | null;
  brandName?: string | null;
  requester: JdfContact;
  administrator?: JdfContact;
  deliveryAddress?: DeliveryAddress;
  quantity: number;
  pdfUrl: string;
  pdfFileName: string;
  /** Finished trim width in mm (default: 85mm = standard business card) */
  trimWidthMm?: number | null;
  /** Finished trim height in mm (default: 55mm = standard business card) */
  trimHeightMm?: number | null;
  customerReference?: string;
  deliveryDueAt?: Date;
  createdAt?: Date;
  paperStock?: TemplatePaperStock | null;
};

const CIP4_NAMESPACE = "http://www.CIP4.org/JDFSchema_1_1";

function iso(value?: Date) {
  return (value ?? new Date()).toISOString();
}

function appendContact(parent: any, type: string, contact?: JdfContact) {
  if (!contact) return;
  const hasAny =
    contact.company ||
    contact.personName ||
    contact.email ||
    contact.phone ||
    contact.mobile ||
    contact.street ||
    contact.city ||
    contact.postalCode;
  if (!hasAny) return;

  const contactNode = parent.ele("Contact", { ContactTypes: type });
  if (contact.company) {
    contactNode.ele("Company", { OrganizationName: contact.company });
  }
  if (contact.street || contact.city || contact.postalCode) {
    contactNode.ele("Address", {
      Street: contact.street ?? undefined,
      City: contact.city ?? undefined,
      PostalCode: contact.postalCode ?? undefined,
      Country: contact.country ?? undefined,
      CountryCode: contact.countryCode ?? undefined,
      Region: contact.region ?? undefined,
    });
  }
  if (contact.personName || contact.email || contact.phone || contact.mobile) {
    const { firstName, familyName } = splitName(contact.personName ?? "");
    const person = contactNode.ele("Person", {
      FirstName: firstName || undefined,
      FamilyName: familyName || undefined,
    });
    if (contact.phone) {
      person.ele("ComChannel", { ChannelType: "Phone", Locator: contact.phone });
    }
    if (contact.mobile) {
      person.ele("ComChannel", { ChannelType: "Phone", ChannelTypeDetails: "Mobile", Locator: contact.mobile });
    }
    if (contact.email) {
      person.ele("ComChannel", { ChannelType: "Email", Locator: contact.email });
    }
  }
}

function splitName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "", familyName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], familyName: "" };
  const familyName = parts.pop() ?? "";
  return { firstName: parts.join(" "), familyName };
}

function appendDeliveryParams(parent: any, address?: DeliveryAddress) {
  const deliveryParams = parent.ele("DeliveryParams", { ID: "DELIVERY_PARAMS" });
  if (!address) return deliveryParams;
  const streetParts = [address.street, address.addressExtra].filter(Boolean);
  deliveryParams.ele("Address", {
    Street: streetParts.length ? streetParts.join(" ") : undefined,
    City: address.city ?? undefined,
    PostalCode: address.postalCode ?? undefined,
    Country: address.country ?? undefined,
    CountryCode: address.countryCode ?? undefined,
  });
  if (address.companyName) {
    deliveryParams.ele("Contact", { ContactTypes: "Delivery" }).ele("Company", {
      OrganizationName: address.companyName,
    });
  }
  return deliveryParams;
}

export function buildJdfDocument(params: BuildJdfParams) {
  const {
    referenceCode,
    templateKey,
    brandName,
    requester,
    administrator,
    deliveryAddress,
    quantity,
    pdfUrl,
    pdfFileName,
    trimWidthMm,
    trimHeightMm,
    customerReference,
    deliveryDueAt,
    createdAt,
    paperStock,
  } = params;

  // Business card default: 85×55mm.
  const widthMm = fmtMm(trimWidthMm ?? 85);
  const heightMm = fmtMm(trimHeightMm ?? 55);

  const descriptiveName = `${brandName ?? "Brand"} Business Card`.trim();
  const doc = create({ version: "1.0", encoding: "UTF-8" });
  const root = doc.ele("JDF", {
    DescriptiveName: descriptiveName,
    ID: `JDF-${referenceCode}`,
    JobID: referenceCode,
    JobPartID: `${referenceCode}-P1`,
    Status: "Waiting",
    Type: "Product",
    Version: "1.5",
    UnitsPerInch: "25.4",
    xmlns: CIP4_NAMESPACE,
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
  });

  const catalogId = params.pcmCode?.trim() || templateKey;
  root.ele("GeneralID", { IDUsage: "CatalogID", IDValue: catalogId });
  const auditPool = root.ele("AuditPool");
  auditPool.ele("Created", {
    AgentName: "druckwerk",
    AgentVersion: "1.0",
    TimeStamp: iso(createdAt),
  });

  const customerInfo = root.ele("CustomerInfo");
  appendContact(customerInfo, "Customer", {
    ...requester,
    company: requester.company ?? brandName ?? undefined,
  });
  appendContact(customerInfo, "Administrator", administrator);

  const productNode = root.ele("JDF", {
    ID: `${referenceCode}-PRODUCT`,
    Type: "Product",
    Status: "Waiting",
    JobPartID: `${referenceCode}-PRODUCT-PART`,
    DescriptiveName: "Business Card",
  });

  const componentId = `${referenceCode}-COMPONENT`;
  const colorIntentId = `${referenceCode}-COLOR`;
  const layoutIntentId = `${referenceCode}-LAYOUT`;
  const mediaIntentId = `${referenceCode}-MEDIA`;

  const productLinkPool = productNode.ele("ResourceLinkPool");
  productLinkPool.ele("ColorIntentLink", { rRef: colorIntentId, Usage: "Input" });
  productLinkPool.ele("LayoutIntentLink", { rRef: layoutIntentId, Usage: "Input" });
  productLinkPool.ele("MediaIntentLink", { rRef: mediaIntentId, Usage: "Input" });
  productLinkPool.ele("ComponentLink", { rRef: componentId, Usage: "Output", Amount: quantity });

  const productResourcePool = productNode.ele("ResourcePool");
  const colorIntent = productResourcePool.ele("ColorIntent", { ID: colorIntentId, Class: "Intent", Status: "Available" });
  const colorsUsed = colorIntent.ele("ColorsUsed");
  ["Cyan", "Magenta", "Yellow", "Black"].forEach((name) => {
    colorsUsed.ele("SeparationSpec", { Name: name });
  });

  const layoutIntent = productResourcePool.ele("LayoutIntent", { ID: layoutIntentId, Class: "Intent", Status: "Available" });
  layoutIntent.ele("Pages", { Actual: "2", DataType: "IntegerSpan", Preferred: "2" });
  layoutIntent.ele("FinishedDimensions", {
    Actual: `${widthMm} ${heightMm} 0`,
    DataType: "ShapeSpan",
    Preferred: `${widthMm} ${heightMm} 0`,
  });

  const mediaIntentDescription = paperStock?.name
    ? `${paperStock.name}${paperStock.weightGsm ? ` ${paperStock.weightGsm}gsm` : ""}`.trim()
    : "Business Card Stock";
  const mediaIntent = productResourcePool.ele("MediaIntent", {
    ID: mediaIntentId,
    Class: "Intent",
    Status: "Available",
    DescriptiveName: mediaIntentDescription,
  });
  if (paperStock?.weightGsm) {
    mediaIntent.ele("Weight", {
      Actual: String(paperStock.weightGsm),
      DataType: "NumberSpan",
      Preferred: String(paperStock.weightGsm),
    });
  }
  if (paperStock?.name) {
    mediaIntent.ele("StockBrand", {
      Actual: paperStock.name,
      DataType: "StringSpan",
      Preferred: paperStock.name,
    });
  }
  productResourcePool.ele("Component", {
    ID: componentId,
    Class: "Quantity",
    Status: "Unavailable",
    ComponentType: "PartialProduct",
  });

  const digitalPrintingId = `${referenceCode}-DIGITAL`;
  const runListId = `${referenceCode}-RUNLIST`;
  const printingParamsId = `${referenceCode}-PRINTPARAMS`;
  const digitalComponentId = `${referenceCode}-DIGITAL-COMP`;

  const digitalNode = root.ele("JDF", {
    ID: digitalPrintingId,
    Type: "Combined",
    Types: "DigitalPrinting",
    JobPartID: `${referenceCode}-DIGITAL-PART`,
    Status: "Waiting",
  });

  const digitalLinkPool = digitalNode.ele("ResourceLinkPool");
  digitalLinkPool.ele("DigitalPrintingParamsLink", { rRef: printingParamsId, Usage: "Input" });
  digitalLinkPool.ele("RunListLink", { rRef: runListId, Usage: "Input" });
  digitalLinkPool.ele("ComponentLink", { rRef: digitalComponentId, Usage: "Output", Amount: quantity });

  const digitalResourcePool = digitalNode.ele("ResourcePool");
  digitalResourcePool.ele("DigitalPrintingParams", { ID: printingParamsId, Class: "Parameter", Status: "Available" });
  const runList = digitalResourcePool.ele("RunList", {
    ID: runListId,
    Class: "Parameter",
    Status: "Available",
    Pages: "0 ~ -1",
  });
  runList
    .ele("LayoutElement")
    .ele("FileSpec", {
      URL: pdfUrl,
      UserFileName: pdfFileName,
    });
  digitalResourcePool.ele("Component", {
    ID: digitalComponentId,
    Class: "Quantity",
    Status: "Unavailable",
    ComponentType: "PartialProduct",
  });

  const deliveryNode = root.ele("JDF", {
    ID: `${referenceCode}-DELIVERY`,
    JobPartID: `${referenceCode}-DELIVERY-PART`,
    Status: "Waiting",
    Type: "Delivery",
  });

  const deliveryLinkPool = deliveryNode.ele("ResourceLinkPool");
  deliveryLinkPool.ele("DeliveryParamsLink", { Usage: "Input", rRef: "DELIVERY_PARAMS" });
  deliveryLinkPool.ele("ComponentLink", { Usage: "Output", rRef: digitalComponentId, Amount: quantity });

  const deliveryResourcePool = deliveryNode.ele("ResourcePool");
  appendDeliveryParams(deliveryResourcePool, deliveryAddress);
  deliveryResourcePool.ele("Component", {
    ID: digitalComponentId,
    Class: "Quantity",
    Status: "Unavailable",
    ComponentType: "PartialProduct",
  });

  const nodeInfo = root.ele("NodeInfo");
  const businessInfo = nodeInfo.ele("BusinessInfo");
  if (customerReference) {
    businessInfo.ele("Comment", { Name: "Customer_Reference" }).txt(customerReference);
  }
  if (deliveryDueAt) {
    businessInfo.ele("Comment", { Name: "Data_Delivery" }).txt(deliveryDueAt.toISOString());
  }
  businessInfo.ele("Comment", { Name: "Job_ID" }).txt(referenceCode);

  return doc.end({ prettyPrint: true });
}

// ─── Per-item PDF JDF (Heidelberg Prinect: 1 JDF = 1 print job) ──────────────

export type BuildPdfItemJdfParams = {
  /** Order reference, e.g. "2026-00018" */
  referenceCode: string;
  /** 1-based index of this item within the order */
  itemIndex: number;
  /** Total number of items in the order */
  itemCount: number;
  /** Renamed PDF filename, e.g. "2026-00018-SO11049112-CMC-500.pdf" */
  pdfFileName: string;
  /** Public URL of the extracted PDF */
  pdfUrl: string;
  /** Original filename from the archive (for identification) */
  originalFilename: string;
  /** Original archive name, e.g. "SO11049112.7z" */
  archiveName: string;
  /** PCM code for Heidelberg press routing (CatalogID) */
  pcmCode?: string | null;
  /** Human-readable product name, e.g. "Brochure A4" */
  productName?: string | null;
  trimWidthMm: number;
  trimHeightMm: number;
  pages: number;
  quantity: number;
  colorSpaces?: string[];
  brandName?: string | null;
  requester: JdfContact;
  administrator?: JdfContact;
  deliveryAddress?: DeliveryAddress;
  customerReference?: string;
  deliveryDueAt?: Date;
  createdAt?: Date;
};

/**
 * Builds a single-job JDF for one PDF print item.
 * Each item in a multi-product order gets its own JDF file (Prinect requirement).
 * All JDFs share the same JobID (order reference) so Prinect can group them.
 */
export function buildPdfItemJdfDocument(params: BuildPdfItemJdfParams): string {
  const {
    referenceCode,
    itemIndex,
    itemCount,
    pdfFileName,
    pdfUrl,
    originalFilename,
    archiveName,
    pcmCode,
    productName,
    trimWidthMm,
    trimHeightMm,
    pages,
    quantity,
    colorSpaces = [],
    brandName,
    requester,
    administrator,
    deliveryAddress,
    customerReference,
    deliveryDueAt,
    createdAt,
  } = params;

  const partId = `${referenceCode}-${itemIndex}`;
  const descriptiveName = `${brandName ?? "Order"} ${referenceCode} – ${productName ?? pdfFileName}`.trim();

  const doc = create({ version: "1.0", encoding: "UTF-8" });
  const root = doc.ele("JDF", {
    DescriptiveName: descriptiveName,
    ID: `JDF-${partId}`,
    JobID: referenceCode,
    JobPartID: partId,
    Status: "Waiting",
    Type: "Product",
    Version: "1.5",
    UnitsPerInch: "25.4",
    xmlns: CIP4_NAMESPACE,
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
  });

  const catalogId = pcmCode?.trim() || "pdf-print";
  root.ele("GeneralID", { IDUsage: "CatalogID", IDValue: catalogId });

  const auditPool = root.ele("AuditPool");
  auditPool.ele("Created", {
    AgentName: "druckwerk",
    AgentVersion: "1.0",
    TimeStamp: iso(createdAt),
  });

  const customerInfo = root.ele("CustomerInfo");
  appendContact(customerInfo, "Customer", {
    ...requester,
    company: requester.company ?? brandName ?? undefined,
  });
  appendContact(customerInfo, "Administrator", administrator);

  // Product node
  const componentId = `${partId}-COMPONENT`;
  const colorIntentId = `${partId}-COLOR`;
  const layoutIntentId = `${partId}-LAYOUT`;
  const mediaIntentId = `${partId}-MEDIA`;

  const productNode = root.ele("JDF", {
    ID: `${partId}-PRODUCT`,
    Type: "Product",
    Status: "Waiting",
    JobPartID: `${partId}-PRODUCT-PART`,
    DescriptiveName: productName ?? pdfFileName,
  });

  const productLinkPool = productNode.ele("ResourceLinkPool");
  productLinkPool.ele("ColorIntentLink", { rRef: colorIntentId, Usage: "Input" });
  productLinkPool.ele("LayoutIntentLink", { rRef: layoutIntentId, Usage: "Input" });
  productLinkPool.ele("MediaIntentLink", { rRef: mediaIntentId, Usage: "Input" });
  productLinkPool.ele("ComponentLink", { rRef: componentId, Usage: "Output", Amount: quantity });

  const productResourcePool = productNode.ele("ResourcePool");

  const colorIntent = productResourcePool.ele("ColorIntent", {
    ID: colorIntentId,
    Class: "Intent",
    Status: "Available",
  });
  const colorsUsed = colorIntent.ele("ColorsUsed");
  const cmykColors = ["Cyan", "Magenta", "Yellow", "Black"];
  const separations = colorSpaces.includes("CMYK") || colorSpaces.length === 0 ? cmykColors : cmykColors;
  separations.forEach((name) => colorsUsed.ele("SeparationSpec", { Name: name }));

  const widthMm = fmtMm(trimWidthMm);
  const heightMm = fmtMm(trimHeightMm);
  const layoutIntent = productResourcePool.ele("LayoutIntent", {
    ID: layoutIntentId,
    Class: "Intent",
    Status: "Available",
  });
  layoutIntent.ele("Pages", {
    Actual: String(pages),
    DataType: "IntegerSpan",
    Preferred: String(pages),
  });
  layoutIntent.ele("FinishedDimensions", {
    Actual: `${widthMm} ${heightMm} 0`,
    DataType: "ShapeSpan",
    Preferred: `${widthMm} ${heightMm} 0`,
  });

  productResourcePool.ele("MediaIntent", {
    ID: mediaIntentId,
    Class: "Intent",
    Status: "Available",
  });

  productResourcePool.ele("Component", {
    ID: componentId,
    Class: "Quantity",
    Status: "Unavailable",
    ComponentType: "PartialProduct",
  });

  // Digital printing node
  const digitalPrintingId = `${partId}-DIGITAL`;
  const runListId = `${partId}-RUNLIST`;
  const printingParamsId = `${partId}-PRINTPARAMS`;
  const digitalComponentId = `${partId}-DIGITAL-COMP`;

  const digitalNode = root.ele("JDF", {
    ID: digitalPrintingId,
    Type: "Combined",
    Types: "DigitalPrinting",
    JobPartID: `${partId}-DIGITAL-PART`,
    Status: "Waiting",
  });

  const digitalLinkPool = digitalNode.ele("ResourceLinkPool");
  digitalLinkPool.ele("DigitalPrintingParamsLink", { rRef: printingParamsId, Usage: "Input" });
  digitalLinkPool.ele("RunListLink", { rRef: runListId, Usage: "Input" });
  digitalLinkPool.ele("ComponentLink", { rRef: digitalComponentId, Usage: "Output", Amount: quantity });

  const digitalResourcePool = digitalNode.ele("ResourcePool");
  digitalResourcePool.ele("DigitalPrintingParams", {
    ID: printingParamsId,
    Class: "Parameter",
    Status: "Available",
    Sides: pages > 1 ? "TwoSidedFlipY" : "OneSided",
  });

  const runList = digitalResourcePool.ele("RunList", {
    ID: runListId,
    Class: "Parameter",
    Status: "Available",
    Pages: "0 ~ -1",
  });
  runList.ele("LayoutElement").ele("FileSpec", {
    URL: pdfUrl,
    UserFileName: pdfFileName,
  });

  digitalResourcePool.ele("Component", {
    ID: digitalComponentId,
    Class: "Quantity",
    Status: "Unavailable",
    ComponentType: "PartialProduct",
  });

  // Delivery node
  const deliveryNode = root.ele("JDF", {
    ID: `${partId}-DELIVERY`,
    JobPartID: `${partId}-DELIVERY-PART`,
    Status: "Waiting",
    Type: "Delivery",
  });

  const deliveryLinkPool = deliveryNode.ele("ResourceLinkPool");
  deliveryLinkPool.ele("DeliveryParamsLink", { Usage: "Input", rRef: `${partId}-DELIVERY-PARAMS` });
  deliveryLinkPool.ele("ComponentLink", { Usage: "Output", rRef: digitalComponentId, Amount: quantity });

  const deliveryResourcePool = deliveryNode.ele("ResourcePool");
  const deliveryParams = deliveryResourcePool.ele("DeliveryParams", { ID: `${partId}-DELIVERY-PARAMS` });
  if (deliveryAddress) {
    const streetParts = [deliveryAddress.street, deliveryAddress.addressExtra].filter(Boolean);
    deliveryParams.ele("Address", {
      Street: streetParts.length ? streetParts.join(" ") : undefined,
      City: deliveryAddress.city ?? undefined,
      PostalCode: deliveryAddress.postalCode ?? undefined,
      Country: deliveryAddress.country ?? undefined,
      CountryCode: deliveryAddress.countryCode ?? undefined,
    });
    if (deliveryAddress.companyName) {
      deliveryParams
        .ele("Contact", { ContactTypes: "Delivery" })
        .ele("Company", { OrganizationName: deliveryAddress.companyName });
    }
  }
  deliveryResourcePool.ele("Component", {
    ID: digitalComponentId,
    Class: "Quantity",
    Status: "Unavailable",
    ComponentType: "PartialProduct",
  });

  // NodeInfo with full job identification
  const nodeInfo = root.ele("NodeInfo");
  const businessInfo = nodeInfo.ele("BusinessInfo");
  businessInfo.ele("Comment", { Name: "Job_ID" }).txt(referenceCode);
  businessInfo.ele("Comment", { Name: "Item_Index" }).txt(`${itemIndex} of ${itemCount}`);
  businessInfo.ele("Comment", { Name: "Source_Archive" }).txt(archiveName);
  businessInfo.ele("Comment", { Name: "Source_File" }).txt(originalFilename);
  if (pcmCode) {
    businessInfo.ele("Comment", { Name: "PCM_Code" }).txt(pcmCode);
  }
  if (customerReference) {
    businessInfo.ele("Comment", { Name: "Customer_Reference" }).txt(customerReference);
  }
  if (deliveryDueAt) {
    businessInfo.ele("Comment", { Name: "Data_Delivery" }).txt(deliveryDueAt.toISOString());
  }

  return doc.end({ prettyPrint: true });
}
