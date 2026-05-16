"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18nStore } from "@/store/useI18nStore";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AuthMenu } from "@/components/AuthMenu";

export default function AboutPage() {
  const t = useI18nStore((s) => s.t);
  const hydrated = useI18nStore((s) => s.hydrated);
  const hydrate = useI18nStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="px-6 lg:px-10 py-4 flex items-center justify-between border-b border-line/60">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center text-canvas text-xs font-semibold">
            M
          </div>
          <span className="font-semibold tracking-tight text-ink">
            {t.brand.name}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <AuthMenu />
        </div>
      </header>

      <section className="px-6 lg:px-10 py-12 max-w-3xl mx-auto">
        <div className="text-[11px] uppercase tracking-wider text-accent mb-3">
          {t.about.title}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-ink mb-4 leading-tight">
          {t.about.leadTitle}
        </h1>
        <p className="text-ink-mute text-base leading-relaxed mb-12">
          {t.about.leadBody}
        </p>

        {/* Flow */}
        <h2 className="text-xl font-bold tracking-tight text-ink mb-5">
          {t.about.flowTitle}
        </h2>
        <ol className="space-y-3 mb-12">
          <FlowStep
            title={t.about.flowStepOneTitle}
            body={t.about.flowStepOneBody}
          />
          <FlowStep
            title={t.about.flowStepTwoTitle}
            body={t.about.flowStepTwoBody}
          />
          <FlowStep
            title={t.about.flowStepThreeTitle}
            body={t.about.flowStepThreeBody}
          />
          <FlowStep
            title={t.about.flowStepFourTitle}
            body={t.about.flowStepFourBody}
          />
        </ol>

        {/* Classification scale */}
        <h2 className="text-xl font-bold tracking-tight text-ink mb-2">
          {t.about.classificationTitle}
        </h2>
        <p className="text-sm text-ink-mute mb-4 leading-relaxed">
          {t.about.classificationBody}
        </p>
        <div className="surface mb-12">
          <ul className="divide-y divide-line">
            <ClassificationRow
              tier="A"
              text={t.about.classificationA}
              color="bg-emerald-50 text-emerald-700 border-emerald-200"
            />
            <ClassificationRow
              tier="B"
              text={t.about.classificationB}
              color="bg-amber-50 text-amber-700 border-amber-200"
            />
            <ClassificationRow
              tier="C"
              text={t.about.classificationC}
              color="bg-orange-50 text-orange-700 border-orange-200"
            />
            <ClassificationRow
              tier="D"
              text={t.about.classificationD}
              color="bg-red-50 text-red-700 border-red-200"
            />
            <ClassificationRow
              tier="E"
              text={t.about.classificationE}
              color="bg-red-100 text-red-800 border-red-300"
            />
          </ul>
        </div>

        {/* Privacy */}
        <h2 className="text-xl font-bold tracking-tight text-ink mb-3">
          {t.about.privacyTitle}
        </h2>
        <p className="text-sm text-ink-mute mb-8 leading-relaxed">
          {t.about.privacyBody}
        </p>

        <div className="border-t border-line pt-8 flex justify-center">
          <Link href="/" className="btn-primary px-5">
            {t.about.ctaBack}
          </Link>
        </div>
      </section>
    </main>
  );
}

function FlowStep({ title, body }: { title: string; body: string }) {
  return (
    <li className="surface-flat p-4">
      <div className="text-sm font-semibold text-ink mb-1">{title}</div>
      <p className="text-sm text-ink-mute leading-relaxed">{body}</p>
    </li>
  );
}

function ClassificationRow({
  tier,
  text,
  color,
}: {
  tier: string;
  text: string;
  color: string;
}) {
  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <span
        className={`inline-flex items-center justify-center w-8 h-7 rounded border text-sm font-semibold ${color}`}
      >
        {tier}
      </span>
      <span className="text-sm text-ink leading-relaxed">{text}</span>
    </li>
  );
}
