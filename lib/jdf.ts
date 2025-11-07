import { create } from "xmlbuilder2";

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
  brandName?: string | null;
  requester: JdfContact;
  administrator?: JdfContact;
  deliveryAddress?: DeliveryAddress;
  quantity: number;
  pdfUrl: string;
  pdfFileName: string;
  customerReference?: string;
  deliveryDueAt?: Date;
  createdAt?: Date;
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
    customerReference,
    deliveryDueAt,
    createdAt,
  } = params;

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
    xmlns: CIP4_NAMESPACE,
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
  });

  root.ele("GeneralID", { IDUsage: "CatalogID", IDValue: templateKey });
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
    Actual: "8.5 5.5 0",
    DataType: "ShapeSpan",
    Preferred: "8.5 5.5 0",
  });

  productResourcePool.ele("MediaIntent", { ID: mediaIntentId, Class: "Intent", Status: "Available" });
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
