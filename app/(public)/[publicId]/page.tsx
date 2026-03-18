import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getPublicContact } from "@/lib/public-contact";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ publicId: string }>;
};

export default async function PublicContactPage({ params }: Props) {
  const { publicId } = await params;
  const headersList = await headers();
  const host = headersList.get("host");
  const contact = await getPublicContact(publicId, host);

  if (!contact) {
    notFound();
  }

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <header className="flex flex-col items-center space-y-6">
          {contact.brand.logoUrl ? (
            <Image
              src={contact.brand.logoUrl}
              alt={contact.brand.name}
              width={128}
              height={48}
              className="object-contain"
              sizes="128px"
            />
          ) : (
            <div className="text-sm font-semibold text-slate-500">{contact.brand.name}</div>
          )}
          {contact.photoUrl ? (
            <Image
              src={contact.photoUrl}
              alt={fullName}
              width={96}
              height={96}
              className="rounded-full object-cover"
              sizes="96px"
            />
          ) : null}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{fullName}</h1>
            {contact.department ? <p className="text-sm text-slate-500">{contact.department}</p> : null}
            {contact.title ? <p className="text-sm text-slate-600">{contact.title}</p> : null}
          </div>
        </header>

        <section className="space-y-6">
          <div className="space-y-2 text-sm text-slate-700">
            {contact.email ? (
              <p>
                <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                  {contact.email}
                </a>
              </p>
            ) : null}
            {contact.phone ? (
              <p>
                <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                  {contact.phone}
                </a>
              </p>
            ) : null}
            {contact.mobile ? (
              <p>
                <a href={`tel:${contact.mobile}`} className="text-blue-600 hover:underline">
                  {contact.mobile}
                </a>
              </p>
            ) : null}
            {contact.linkedin ? (
              <p>
                <a
                  href={contact.linkedin}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </p>
            ) : null}
            {contact.website ? (
              <p>
                <a
                  href={contact.website}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {contact.website}
                </a>
              </p>
            ) : null}
          </div>
          <a
            href={`/api/public/contacts/${contact.publicId}/vcard`}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800",
            )}
          >
            Add Contact
          </a>
        </section>
      </div>
    </main>
  );
}
