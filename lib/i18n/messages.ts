export const locales = ["en", "de"] as const;
export type Locale = typeof locales[number];

export const messages = {
  en: {
    nav: {
      orders: "Orders",
      newOrder: "New Order",
      adminBrands: "Admin · Brands",
      logout: "Logout",
    },
    layout: {
      brandTitle: "Omicron",
      brandSubtitle: "Business Card Portal",
      signedInAs: "Signed in as",
      roles: {
        USER: "User",
        ADMIN: "Admin",
        PRINTER: "Printer",
      } as Record<string, string>,
      settings: {
        open: "Open user settings",
        title: "User settings",
        description: "Update your personal preferences.",
      },
    },
    language: {
      label: "Language",
      en: "English",
      de: "German",
    },
    orderForm: {
      title: "New Order",
      subtitle: "Configure your business card details before submitting.",
      infoTitle: "Order information",
      quantity: "Quantity",
      template: "Template",
      deliveryTime: "Delivery Time",
      deliveryTimes: {
        express: "Express",
        "1week": "1 Week",
        "2weeks": "2 Weeks",
      } as Record<string, string>,
      expressNotice: "⚠️ Express delivery will cause additional costs.",
      detailsTitle: "Details",
      placeholders: {
        quantity: "Select quantity",
        template: "Select template",
        deliveryTime: "Select delivery time",
      },
      fields: {
        name: "Name",
        role: "Function / Title",
        phone: "Phone",
        mobile: "Mobile",
        email: "E-mail",
        linkedin: "LinkedIn",
        linkedinPlaceholder: "https://www.linkedin.com/in/username",
        url: "URL",
        company: "Company & Address",
      },
      previewTitle: "Preview",
      buttons: {
        order: "Order Business Card",
      },
      confirm: {
        title: "Confirm order",
        description: "Review the preview before submitting your business card order.",
        front: "Front",
        back: "Back",
        cancel: "Back",
        submit: "Confirm order",
        submitting: "Saving order…",
      },
      errors: {
        generic: "Unexpected error while saving order",
      },
    },
    ordersPage: {
      title: "Orders",
      subtitle: "Here you can find your recent submissions.",
      success: "Order saved successfully.",
      empty: "No orders yet. Start with “New Order”.",
      buttonNew: "New Order",
      table: {
        reference: "Reference",
        created: "Created",
        user: "User",
        template: "Template",
        quantity: "Quantity",
        status: "Status",
        pdf: "PDF",
        viewPdf: "View PDF",
      },
    },
    statuses: {
      DRAFT: "Draft",
      SUBMITTED: "Submitted",
      IN_PRODUCTION: "In production",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    } as Record<string, string>,
  },
  de: {
    nav: {
      orders: "Bestellungen",
      newOrder: "Neue Bestellung",
      adminBrands: "Admin · Marken",
      logout: "Abmelden",
    },
    layout: {
      brandTitle: "Omicron",
      brandSubtitle: "Visitenkarten-Portal",
      signedInAs: "Angemeldet als",
      roles: {
        USER: "Benutzer",
        ADMIN: "Admin",
        PRINTER: "Druckerei",
      },
      settings: {
        open: "Benutzereinstellungen öffnen",
        title: "Benutzereinstellungen",
        description: "Passe deine persönlichen Einstellungen an.",
      },
    },
    language: {
      label: "Sprache",
      en: "Englisch",
      de: "Deutsch",
    },
    orderForm: {
      title: "Neue Bestellung",
      subtitle: "Konfiguriere die Visitenkarte, bevor du sie bestätigst.",
      infoTitle: "Bestellinformationen",
      quantity: "Menge",
      template: "Vorlage",
      deliveryTime: "Lieferzeit",
      deliveryTimes: {
        express: "Express",
        "1week": "1 Woche",
        "2weeks": "2 Wochen",
      },
      expressNotice: "⚠️ Expressversand verursacht zusätzliche Kosten.",
      detailsTitle: "Details",
      placeholders: {
        quantity: "Menge auswählen",
        template: "Vorlage auswählen",
        deliveryTime: "Lieferzeit auswählen",
      },
      fields: {
        name: "Name",
        role: "Funktion / Titel",
        phone: "Telefon",
        mobile: "Mobil",
        email: "E-Mail",
        linkedin: "LinkedIn",
        linkedinPlaceholder: "https://www.linkedin.com/in/username",
        url: "URL",
        company: "Firma & Adresse",
      },
      previewTitle: "Vorschau",
      buttons: {
        order: "Visitenkarte bestellen",
      },
      confirm: {
        title: "Bestellung bestätigen",
        description: "Bitte überprüfe die Vorschau, bevor du die Visitenkarte bestellst.",
        front: "Vorderseite",
        back: "Rückseite",
        cancel: "Zurück",
        submit: "Bestellung bestätigen",
        submitting: "Bestellung wird gespeichert…",
      },
      errors: {
        generic: "Unerwarteter Fehler beim Speichern der Bestellung",
      },
    },
    ordersPage: {
      title: "Bestellungen",
      subtitle: "Hier findest du deine zuletzt übermittelten Bestellungen.",
      success: "Bestellung erfolgreich gespeichert.",
      empty: "Noch keine Bestellungen vorhanden. Starte mit „Neue Bestellung“.",
      buttonNew: "Neue Bestellung",
      table: {
        reference: "Referenz",
        created: "Erstellt",
        user: "Benutzer",
        template: "Vorlage",
        quantity: "Menge",
        status: "Status",
        pdf: "PDF",
        viewPdf: "PDF ansehen",
      },
    },
    statuses: {
      DRAFT: "Entwurf",
      SUBMITTED: "Eingereicht",
      IN_PRODUCTION: "In Produktion",
      COMPLETED: "Abgeschlossen",
      CANCELLED: "Storniert",
    },
  },
} as const;

export type Messages = (typeof messages)[Locale];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function getTranslations(locale: Locale): Messages {
  return messages[locale];
}
