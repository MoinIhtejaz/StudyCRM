interface SummaryCard {
  label: string;
  value: number;
  tone: "neutral" | "urgent" | "overdue" | "active" | "completed";
}

interface SummaryCardsProps {
  cards: SummaryCard[];
}

const toneMap: Record<SummaryCard["tone"], string> = {
  neutral: "bg-white border-slate-200",
  urgent: "bg-amber-50 border-amber-200",
  overdue: "bg-rose-50 border-rose-200",
  active: "bg-teal-50 border-teal-200",
  completed: "bg-emerald-50 border-emerald-200"
};

export const SummaryCards = ({ cards }: SummaryCardsProps) => {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-2xl border p-4 ${toneMap[card.tone]}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
        </div>
      ))}
    </section>
  );
};
