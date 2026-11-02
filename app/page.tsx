import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ScanLine,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  Plus,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
export default function Home() {
  return (
    <div className="as-home">
      <SiteHeader />
      <main id="main-content">
        <section className="as-hero container">
          <div className="as-hero-copy">
            <span className="as-kicker">
              <span /> YOUR NEXT PURCHASE, A LITTLE CLEARER
            </span>
            <h1>
              Love the look.
              <br />
              Know the <em>details.</em>
            </h1>
            <p>
              A better way to shop for what matters to you. Check the listing,
              uncover the unknowns, and preview the look with YouCam—before you
              decide.
            </p>
            <div className="as-actions">
              <Link className="as-primary" href="/check">
                Check an item <ArrowUpRight size={18} />
              </Link>
              <Link className="as-secondary" href="/check?example=1">
                Explore an example <ArrowRight size={17} />
              </Link>
            </div>
            <div className="as-small">
              <ShieldCheck size={16} /> Start without a selfie. No account
              needed.
            </div>
          </div>
          <div className="as-collage">
            <div className="as-image-label">
              <Sparkles size={14} /> A LITTLE PREVIEW. A LOT MORE CONTEXT.
            </div>
            <div className="as-photo">
              <img
                src="/demo/youcam-live-tryon.jpg"
                alt="Synthetic sample shopper in a rust jacket, from a previously recorded YouCam generation"
              />
              <span>Recorded YouCam example · synthetic person</span>
            </div>
            <div className="as-floating as-float-one">
              <span className="as-circle">
                <ListChecks size={19} />
              </span>
              <div>
                <b>Your must-haves come first.</b>
                <small>Care, coverage, closures & more</small>
              </div>
            </div>
            <div className="as-floating as-float-two">
              <span className="as-status unknown">? &nbsp; STILL UNKNOWN</span>
              <h3>Real pockets, or just the look?</h3>
              <p>
                A preview can’t tell you everything.
                <br />
                We help you ask the right question.
              </p>
            </div>
            <div className="as-caption">
              THE LOOK IS ONLY PART OF THE STORY. ↗
            </div>
          </div>
        </section>
        <div className="as-principles">
          <div className="container">
            <span>
              <ListChecks size={18} /> Your requirements, respected
            </span>
            <span>
              <ScanLine size={18} /> Evidence you can inspect
            </span>
            <span>
              <Sparkles size={18} /> Powered by YouCam previews
            </span>
            <span>
              <ShieldCheck size={18} /> Your photos, your choice
            </span>
          </div>
        </div>
        <section className="container as-section" id="how-it-works">
          <div className="as-section-heading">
            <div>
              <span className="as-kicker">
                FROM “I LIKE IT” TO “IS IT RIGHT FOR ME?”
              </span>
              <h2>
                A second look.
                <br />A better-informed choice.
              </h2>
            </div>
            <p>
              For the details that make a difference in everyday life. Nothing
              averaged away. Nothing quietly assumed.
            </p>
          </div>
          <div className="as-steps">
            {[
              {
                icon: Plus,
                title: "Bring the item.",
                copy: "Add product photos and paste the listing. Confirm the color and size you’re considering.",
              },
              {
                icon: ListChecks,
                title: "Make it yours.",
                copy: "Set your essentials and preferences. See what the sources support, contradict, or leave unanswered.",
              },
              {
                icon: MessageSquareText,
                title: "Decide with context.",
                copy: "Compare your shortlist, try an optional YouCam preview, and ask for the evidence you still need.",
              },
            ].map(({ icon: Icon, title, copy }, i) => (
              <article key={title}>
                <div>
                  <Icon size={23} />
                  <span>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="container as-callout">
          <div>
            <span className="as-kicker">
              BUILT AROUND REAL-LIFE REQUIREMENTS
            </span>
            <h2>
              Easy care. More coverage.
              <br />A closure that works for you.
            </h2>
            <p>
              You don’t need to explain why it matters. Just tell us that it
              does.
            </p>
            <Link className="as-primary" href="/check">
              Find your next good decision <ArrowRight size={17} />
            </Link>
          </div>
          <div className="as-requirement-art">
            <span>YOUR SHOPPING REQUIREMENTS</span>
            {[
              "Machine washable",
              "Full-length sleeves",
              "Functional pockets",
            ].map((t) => (
              <div key={t}>
                <ListChecks size={18} />
                {t}
                <small>Essential</small>
              </div>
            ))}
            <p>Unknowns stay visible. Essentials stay essential.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
