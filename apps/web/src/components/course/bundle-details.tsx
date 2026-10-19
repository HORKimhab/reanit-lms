import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { BundleView } from "@/server/commerce/bundles";

import { BuyBox, MobileBuyBar } from "./course-details";

/**
 * Bundle sales page body: what the bundle is, the courses it holds (each linking to its own page),
 * and a buy box.
 *
 * @param props - Component props.
 * @param props.bundle - The published bundle.
 * @param props.schoolPath - The school site's path, for the course links.
 * @param props.checkoutHref - The bundle's checkout page.
 * @returns The sales page, with a sticky buy box on desktop and a pinned buy bar on mobile.
 */
export function BundleDetails({ bundle, schoolPath, checkoutHref }: { bundle: BundleView; schoolPath: string; checkoutHref: string }) {
  const t = useTranslations("BundlePage");

  return (
    <div className="flex flex-col gap-12 pb-20 lg:pb-0">
      <section className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{bundle.title}</h1>
          {bundle.description ? <p className="whitespace-pre-line text-lg text-muted-foreground">{bundle.description}</p> : null}
          <p className="text-sm text-muted-foreground">{t("includes", { count: bundle.courses.length })}</p>
        </div>
        <BuyBox price={bundle.price} checkoutHref={checkoutHref} className="hidden lg:flex lg:row-span-2 lg:self-start lg:sticky lg:top-24" />
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{t("coursesTitle")}</h2>
          <ol className="divide-y rounded-xl border">
            {bundle.courses.map((course) => (
              <li key={course.id}>
                <Link href={`${schoolPath}/courses/${course.slug}`} className="block px-5 py-4 font-medium hover:text-primary hover:underline">
                  {course.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </section>
      <MobileBuyBar price={bundle.price} checkoutHref={checkoutHref} />
    </div>
  );
}
