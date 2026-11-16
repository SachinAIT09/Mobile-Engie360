import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Code2,
  Gauge,
  Laptop,
  Menu,
  Search,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  User,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { EngieAssistantWidget, type EngieAssistantHandle } from '../widget/EngieAssistantWidget';
import type { Audience } from '../assistant/types';
import './website.css';
import { brand } from '../brand';

const EMBED = `<!-- ${brand.name} Assistant: one script tag, no changes to the page -->
<div id="engie-assistant"></div>
<script src="https://cdn.example.com/engie-assistant/v1.js"
        data-locale="nl"
        data-auth="mijnengie-session"
        defer></script>`;

/** Illustrative day-ahead prices (€/kWh) for the hero chart; the cheapest hours are highlighted. */
const HOURLY = [0.21, 0.19, 0.17, 0.15, 0.14, 0.15, 0.19, 0.26, 0.29, 0.24, 0.18, 0.13, 0.11, 0.12, 0.16, 0.2, 0.25, 0.31, 0.33, 0.29, 0.25, 0.23, 0.22, 0.21];

function SiteLogo({ light }: { light?: boolean }) {
  return <span className={`site-logo${light ? ' light' : ''}`}>{brand.name}</span>;
}

/** Card with the engie.nl cyan-to-teal bottom edge and a chevron link row. */
function EdgeCard({ top, title, children, link, onClick }: { top?: ReactNode; title: string; children?: ReactNode; link: string; onClick: () => void }) {
  return (
    <article className="site-card">
      {top}
      <div className="site-card-body">
        {title && <h3>{title}</h3>}
        {children && <p>{children}</p>}
        <button className="site-card-link" onClick={onClick}>
          <span>{link}</span>
          <ChevronRight size={20} />
        </button>
      </div>
    </article>
  );
}

export default function WebsiteDemo() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const widget = useRef<EngieAssistantHandle>(null);
  const [audience, setAudience] = useState<Audience>('visitor');
  const [showCode, setShowCode] = useState(false);
  const [menu, setMenu] = useState(false);
  const [review, setReview] = useState(0);
  const [postcode, setPostcode] = useState('');
  const [house, setHouse] = useState('');
  const ask = (q: string) => widget.current?.open(q);

  const cheapest = Math.min(...HOURLY);
  const maxPrice = Math.max(...HOURLY);

  const products = [
    { name: t('Dynamic Electricity & Gas', 'Dynamische Stroom & Gas'), tags: [t('Saving', 'Besparen'), t('Flexible', 'Flexibel')], body: t('Benefit from changing electricity and gas prices.', 'Profiteren van wisselende stroom- en gasprijzen.') },
    { name: t('Dynamic Electricity & Fixed Gas', 'Dynamische Stroom & Vast Gas'), tags: [t('Certain', 'Zeker'), t('Saving', 'Besparen')], body: t('Save on electricity, certainty for gas.', 'Besparen op stroom, zekerheid voor gas.') },
    { name: t('Fixed Electricity & Gas', 'Vaste Stroom & Gas'), tags: [t('Certain', 'Zeker')], body: t('The certainty of fixed electricity and gas prices.', 'De zekerheid van vaste stroom- en gasprijzen.') },
    { name: t('Variable Electricity & Gas', 'Variabele Stroom & Gas'), tags: [t('Flexible', 'Flexibel')], body: t('Variable prices, cancel monthly.', 'Variabele prijzen, per maand opzegbaar.') },
  ];

  const reviews = [
    t('“Very satisfied. I always get honest advice. The customer comes first!”', '‘Zeer tevreden. Ik krijg altijd eerlijke adviezen. De klant staat voorop!’'),
    t('“Switching was arranged within a day. Nothing to worry about.”', '‘Overstappen was binnen een dag geregeld. Nergens zorgen over.’'),
    t('“The app shows exactly where my energy goes.”', '‘In de app zie ik precies waar mijn energie heen gaat.’'),
    t('“Friendly customer service that really listens.”', '‘Vriendelijke klantenservice die echt luistert.’'),
  ];

  const findOffer = (e: FormEvent) => {
    e.preventDefault();
    const pc = postcode.trim().toUpperCase() || '1234AB';
    ask(t(`Which offer suits me? Postcode ${pc} ${house}`.trim(), `Welk aanbod past bij mij? Postcode ${pc} ${house}`.trim()));
  };

  return (
    <div className="site">
      {/* Demo control bar — not part of the mock website */}
      <div className="demo-bar">
        <div className="demo-bar-inner">
          <Link to="/" className="demo-back">
            <ArrowLeft size={16} /> {t('Back to portal', 'Terug naar portaal')}
          </Link>
          <span className="demo-title">
            <b>{t('Website widget demo', 'Website-widget demo')}</b>
            <span>{t('Local mock-up modelled on engie.nl. Not the live website.', 'Lokale mock-up naar het voorbeeld van engie.nl. Niet de echte website.')}</span>
          </span>
          <span className="demo-ctrls">
            <span className="seg">
              <button className={audience === 'visitor' ? 'on' : ''} onClick={() => setAudience('visitor')}>
                {t('Visitor', 'Bezoeker')}
              </button>
              <button className={audience === 'customer' ? 'on' : ''} onClick={() => setAudience('customer')}>
                {t('Signed in', 'Ingelogd')}
              </button>
            </span>
            <span className="seg">
              <button className={lang === 'nl' ? 'on' : ''} onClick={() => setLang('nl')}>
                NL
              </button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                EN
              </button>
            </span>
            <button className="btn btn-sm btn-white" onClick={() => setShowCode(!showCode)} aria-expanded={showCode}>
              <Code2 size={15} /> {t('Embed code', 'Embedcode')}
            </button>
          </span>
        </div>
        {showCode && (
          <div className="demo-code">
            <pre>{EMBED}</pre>
            <p>
              {t(
                `The widget (src/widget/EngieAssistantWidget.tsx) is self-contained: launcher, chat and session, talking to a swappable AssistantProvider. When the visitor is signed in to ${brand.portal}, the same session token unlocks personal answers.`,
                `De widget (src/widget/EngieAssistantWidget.tsx) is zelfstandig: knop, chat en sessie, gekoppeld aan een verwisselbare AssistantProvider. Is de bezoeker ingelogd bij ${brand.portal}, dan geeft hetzelfde sessietoken persoonlijke antwoorden.`,
              )}
            </p>
          </div>
        )}
      </div>

      {/* ---- Mock website ---- */}
      <header className="site-header">
        <div className="site-top">
          <div className="site-wrap site-top-row">
            <nav className="site-segments" aria-label={t('Audience', 'Doelgroep')}>
              <a className="on">{t('Home', 'Thuis')}</a>
              <a>{t('Self-employed & SME', 'Zzp & mkb')}</a>
              <a>{t('Large business', 'Grootzakelijk')}</a>
            </nav>
            <nav className="site-utility" aria-label="Service">
              <a onClick={() => ask(t('I want to speak to customer service', 'Ik wil de klantenservice spreken'))}>{t('Customer service', 'Klantenservice')}</a>
              <a>{t('About us', 'Over ons')}</a>
              <a>{t('Careers', 'Werken bij')}</a>
            </nav>
          </div>
        </div>
        <div className="site-bar">
          <div className="site-wrap site-main-nav">
            <SiteLogo light />
            <nav className={`site-nav${menu ? ' open' : ''}`} aria-label={t('Main menu', 'Hoofdmenu')}>
              <a>{t('Energy', 'Energie')}</a>
              <a>{t('Products & advice', 'Product en advies')}</a>
              <a onClick={() => ask(t('When is the best time to charge my EV?', 'Wanneer kan ik mijn auto het best laden?'))}>{t('Smart charging', 'Slim Laden')}</a>
            </nav>
            <button className="site-icon" aria-label={t('Search', 'Zoeken')} onClick={() => ask('')}>
              <Search size={22} />
            </button>
            <button className="site-login" onClick={() => navigate('/')}>
              {t(`Log in ${brand.portal}`, `Inloggen ${brand.portal}`)} <User size={20} />
            </button>
            <button className="site-icon site-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              {menu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="site-hero">
          <div className="site-wrap site-hero-grid">
            <div className="site-hero-copy">
              <h1>{t('Enjoy savings and certainty in one contract', 'Profiteer van voordeel én zekerheid in één contract')}</h1>
              <p>{t('Choose Dynamic Electricity & Fixed Gas as well', 'Kies ook voor Dynamische Stroom & Vast Gas')}</p>
              <div className="site-hero-ctas">
                <button className="site-btn-yellow">{t('Discover more', 'Ontdek meer')}</button>
                <button className="site-btn-outline" onClick={() => ask(t('Which energy contract suits me?', 'Welk energiecontract past bij mij?'))}>
                  <Sparkles size={18} /> {t('Ask what suits you', 'Vraag wat bij je past')}
                </button>
              </div>
            </div>
            <div className="site-hero-art" aria-hidden>
              <div className="halo" />
              <div className="price-card">
                <div className="price-head">
                  <span>{t('Dynamic electricity · today', 'Dynamische stroom · vandaag')}</span>
                  <b className="num">€0,11</b>
                  <small>{t('cheapest at 12:00, per kWh', 'goedkoopst om 12:00, per kWh')}</small>
                </div>
                <div className="price-bars">
                  {HOURLY.map((p, h) => (
                    <i key={h} className={p <= cheapest + 0.02 ? 'low' : ''} style={{ height: `${(p / maxPrice) * 100}%` }} />
                  ))}
                </div>
                <div className="price-axis">
                  <span>00</span>
                  <span>06</span>
                  <span>12</span>
                  <span>18</span>
                  <span>24</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="site-offer-dock">
          <form className="site-offer" onSubmit={findOffer}>
            <div className="site-offer-title">
              <b>{t('Discover your offer', 'Ontdek jouw aanbod')}</b>
              <span>{t('Enter your postcode', 'Vul jouw postcode in')}</span>
            </div>
            <div className="site-offer-fields">
              <label>
                <span>Postcode *</span>
                <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="1234AB" maxLength={7} />
              </label>
              <label className="sm">
                <span>{t('No.', 'Huisnr')} *</span>
                <input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="1" inputMode="numeric" maxLength={5} />
              </label>
              <label className="md">
                <span>{t('Addition (optional)', 'Toevoeging (optioneel)')}</span>
                <input placeholder="A" maxLength={4} />
              </label>
              <button type="submit" className="site-btn-yellow">
                {t('View offer', 'Bekijk aanbod')}
              </button>
              <p className="site-offer-foot">
                <span>
                  {t('Already a customer?', 'Al klant?')}{' '}
                  <a onClick={() => setAudience('customer')}>{t('Log in for your offer →', 'Log in voor je aanbod →')}</a>
                </span>
                <span>* {t('required field', 'verplicht veld')}</span>
              </p>
            </div>
          </form>
        </div>

        <section className="site-wrap site-section">
          <h2>{t('All arranged', 'Zó geregeld')}</h2>
          <div className="site-grid-4">
            <EdgeCard
              top={<div className="site-card-icon"><Laptop size={88} strokeWidth={1.4} /></div>}
              title={brand.portal}
              link={t(`Log in to ${brand.portal}`, `Inloggen bij ${brand.portal}`)}
              onClick={() => navigate('/')}
            >
              {t(`Log in to your personal ${brand.portal} environment. Arrange all your energy matters easily.`, `Log in bij jouw persoonlijke ${brand.portal}-omgeving. Hier regel je eenvoudig al je energiezaken.`)}
            </EdgeCard>
            <EdgeCard
              top={<div className="site-card-icon"><Smartphone size={88} strokeWidth={1.4} /></div>}
              title={t(`${brand.name} app`, `${brand.name}-app`)}
              link={t(`All about the ${brand.name} app`, `Alles over de ${brand.name}-app`)}
              onClick={() => navigate('/mobile-preview')}
            >
              {t('Do you already use the free app? See your energy usage and costs anywhere, any time. Handy, right?', `Gebruik jij de gratis ${brand.name}-app al? Hierin zie je altijd en overal jouw energieverbruik en energiekosten. Handig toch?`)}
            </EdgeCard>
            <EdgeCard
              top={<div className="site-card-icon"><CalendarClock size={88} strokeWidth={1.4} /></div>}
              title={t('Installment check', 'Termijnbedragcheck')}
              link={t('Go to the installment check', 'Naar de termijnbedragcheck')}
              onClick={() => ask(t('Is my monthly installment still right?', 'Klopt mijn termijnbedrag nog?'))}
            >
              {t('Avoid surprises on your annual statement and check your installment regularly.', 'Voorkom verrassingen bij je jaarrekening en doe regelmatig de termijnbedragcheck. Zo zie je direct of je nog goed zit.')}
            </EdgeCard>
            <EdgeCard
              top={<div className="site-card-icon"><Sun size={88} strokeWidth={1.4} /></div>}
              title={t('Go sustainable', 'Verduurzamen')}
              link={t('View our products', 'Bekijk onze producten')}
              onClick={() => ask(t('Are solar panels worth it for me?', 'Lonen zonnepanelen voor mij?'))}
            >
              {t(`${brand.name} helps with heat pumps, solar panels and home batteries.`, `${brand.name} helpt je met oplossingen zoals warmtepompen, zonnepanelen en thuisbatterijen.`)}
            </EdgeCard>
          </div>
        </section>

        <section className="site-wrap site-section">
          <h2>{t('What matters most to you about your energy?', 'Wat vind jij het belangrijkste aan je energie?')}</h2>
          <p className="site-intro">
            {t(
              'We like to make it extra easy to find what suits you. That is why we use these labels on our products.',
              'Wij maken het je graag extra makkelijk om te vinden wat bij je past. Daarom gebruiken we de onderstaande labels bij onze producten.',
            )}
          </p>
          <div className="site-grid-3">
            {[
              { l: t('Carefree certainty', 'Zorgeloos zeker'), d: t('You want the certainty of fixed prices without actively managing your usage.', 'Je wilt de zekerheid van vaste prijzen, zonder actief met je verbruik bezig te zijn.'), q: t('I want a fixed contract', 'Ik wil een vast contract') },
              { l: t('Saving actively', 'Actief besparen'), d: t('You want to pay as little as possible and happily shift when you use energy.', 'Je wilt zo min mogelijk betalen en past daar gerust je verbruiksmomenten voor aan.'), q: t('Tell me about dynamic tariffs', 'Vertel over dynamische tarieven') },
              { l: t('Maximally flexible', 'Maximaal flexibel'), d: t('You don’t want a long commitment and decide yourself when to switch.', 'Je wilt nergens lang aan vastzitten en zelf bepalen wanneer je overstapt.'), q: t('Which energy contract suits me?', 'Welk energiecontract past bij mij?') },
            ].map((u) => (
              <button key={u.l} className="site-card site-label" onClick={() => ask(u.q)}>
                <span className="site-card-body">
                  <h3>{u.l}</h3>
                  <p>{u.d}</p>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="site-wrap site-section">
          <h2>{t('Choose what suits you', 'Kies wat bij je past')}</h2>
          <div className="site-grid-4 site-products">
            {products.map((p) => (
              <EdgeCard
                key={p.name}
                top={
                  <div className="site-product-head">
                    <div className="site-chips">
                      {p.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <h3>{p.name}</h3>
                  </div>
                }
                title=""
                link={`${t('More about', 'Meer over')} ${p.name}`}
                onClick={() => ask(t(`Tell me about ${p.name}`, `Vertel over ${p.name}`))}
              >
                {p.body}
              </EdgeCard>
            ))}
          </div>
        </section>

        <section className="site-wrap site-section">
          <h2>{t('Energy the way you want it', 'Energie zoals jij dat wilt')}</h2>
          <p className="site-intro">
            {t(
              `At ${brand.name} you don’t need to be an energy expert. The market changes fast and we understand you’d rather not deal with it. We keep track for you, tailor our service and give personal tips to use energy even smarter. You decide how involved you want to be.`,
              `Bij ${brand.name} hoef je geen energie-expert te zijn. De energiemarkt verandert snel en we begrijpen dat je daar liever niet te veel mee bezig bent. Wij houden de ontwikkelingen voor je in de gaten, stemmen onze dienstverlening daarop af en geven je persoonlijke tips om nóg slimmer met je energie om te gaan. En je bepaalt zelf hoe actief je daarbij betrokken wilt zijn.`,
            )}
          </p>
          <div className="site-grid-2">
            <EdgeCard
              top={
                <div className="site-card-art a">
                  <Users size={72} strokeWidth={1.3} />
                </div>
              }
              title={t(`Switch to ${brand.name}`, `Overstappen naar ${brand.name}`)}
              link={t('Advice for new customers', 'Advies voor nieuwe klanten')}
              onClick={() => ask(t(`How do I switch to ${brand.name}?`, `Hoe stap ik over naar ${brand.name}?`))}
            >
              {t('Switching is easy. Our energy advisors look at what suits you best, then arrange the switch with your current supplier.', 'Je overstap is zo geregeld. Onze energieadviseurs kijken samen met jou wat het beste bij je past. Daarna regelen we de overstap met je huidige leverancier.')}
            </EdgeCard>
            <EdgeCard
              top={
                <div className="site-card-art b">
                  <Smartphone size={72} strokeWidth={1.3} />
                </div>
              }
              title={t('Already a customer? Check if it can be smarter', 'Je bent al klant? Check of het slimmer kan')}
              link={t(`Advice for ${brand.name} customers`, `Advies voor ${brand.name}-klanten`)}
              onClick={() => ask(t('How can I reduce my electricity costs?', 'Hoe kan ik mijn stroomkosten verlagen?'))}
            >
              {t('Has something changed at home, or do you use less thanks to smart appliances? We’ll check how you can save more.', 'Is er iets veranderd in je huishouden of heb je minder verbruik door slimme apparaten? Dan kijken we hoe je nog voordeliger uit kunt zijn.')}
            </EdgeCard>
          </div>
        </section>

        <section className="site-wide site-reviews">
          <div className="site-score">
            <b>8,0</b>
            <h3>{t('Given by our customers', 'Van onze klanten gekregen')}</h3>
            <p>{t('90% of our customers recommend us, based on 3500+ reviews (illustrative)', '90% van onze klanten beveelt ons aan, op basis van 3500+ waarderingen (illustratief)')}</p>
          </div>
          <div className="site-quote">
            <blockquote key={review}>{reviews[review]}</blockquote>
            <div className="site-stars" aria-label={t('5 stars', '5 sterren')}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={24} fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <div className="site-quote-nav">
              <span className="track">
                <i style={{ width: `${100 / reviews.length}%`, transform: `translateX(${review * 100}%)` }} />
              </span>
              <button aria-label={t('Previous review', 'Vorige review')} onClick={() => setReview((review + reviews.length - 1) % reviews.length)}>
                <ArrowLeft size={24} />
              </button>
              <button aria-label={t('Next review', 'Volgende review')} onClick={() => setReview((review + 1) % reviews.length)}>
                <ArrowRight size={24} />
              </button>
            </div>
          </div>
        </section>

        <section className="site-wrap site-section site-green">
          <div>
            <h2>{t('Dutch green electricity', 'Nederlandse groene stroom')}</h2>
            <p>
              {t(
                `With ${brand.name} you choose green electricity backed by Dutch Guarantees of Origin (GOs). These certificates show where the electricity was generated. Read more about the origin of our electricity on our `,
                `Bij ${brand.name} kies je voor groene stroom met Nederlandse Garanties van Oorsprong (GvO's). Deze certificaten laten zien waar de opgewekte stroom vandaan komt. Je leest meer over de herkomst van onze stroom op ons `,
              )}
              <a onClick={() => ask(t('Is your electricity green?', 'Is jullie stroom groen?'))}>{t('fuel mix label', 'stroometiket')}</a>
              {t(' and on our green electricity page.', ' en op de pagina over onze groene stroom.')}
            </p>
            <button className="site-card-link inline" onClick={() => ask(t('Is your electricity green?', 'Is jullie stroom groen?'))}>
              <span>{t('More about our green electricity', 'Meer over onze groene stroom')}</span>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="site-green-art" aria-hidden>
            <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMax slice">
              <path d="M0 260 Q 100 225 200 250 T 400 240 V320 H0Z" fill="#7cc66b" />
              <path d="M0 285 Q 120 255 240 280 T 400 270 V320 H0Z" fill="#4ea84a" />
              <g fill="#fff">
                <rect x="246" y="92" width="7" height="170" rx="3" />
                <circle cx="249.5" cy="92" r="7" />
                <g transform="rotate(-18 249.5 92)">
                  <path d="M248 92 L 244 6 Q 249 0 254 6 L 251 92Z" />
                  <path d="M248 92 L 244 6 Q 249 0 254 6 L 251 92Z" transform="rotate(120 249.5 92)" />
                  <path d="M248 92 L 244 6 Q 249 0 254 6 L 251 92Z" transform="rotate(240 249.5 92)" />
                </g>
                <rect x="96" y="168" width="4" height="100" rx="2" opacity=".85" />
                <g transform="rotate(14 98 168)" opacity=".85">
                  <path d="M97 168 L 95 118 Q 98 114 101 118 L 99 168Z" />
                  <path d="M97 168 L 95 118 Q 98 114 101 118 L 99 168Z" transform="rotate(120 98 168)" />
                  <path d="M97 168 L 95 118 Q 98 114 101 118 L 99 168Z" transform="rotate(240 98 168)" />
                </g>
              </g>
            </svg>
          </div>
        </section>

        <section className="site-self">
          <div className="site-wrap site-section">
            <div className="site-self-head">
              <h2>{t('Do it yourself, easily', 'Doe het makkelijk zelf')}</h2>
              <button className="site-card-link inline" onClick={() => navigate('/')}>
                <span>{t(`Log in to ${brand.portal} and arrange the rest`, `Log in bij ${brand.portal} en regel de rest`)}</span>
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="site-grid-4">
              {[
                { icon: CalendarClock, l: t('Installment', 'Termijnbedrag'), link: t('Adjust your installment', 'Je termijnbedrag aanpassen'), q: t('What is my current monthly installment?', 'Wat is mijn huidige termijnbedrag?') },
                { icon: UserRound, l: t('Details', 'Gegevens'), link: t('Change your details', 'Je gegevens wijzigen'), q: t('I am moving house', 'Ik ga verhuizen') },
                { icon: Gauge, l: t('Meter readings', 'Meterstanden'), link: t('Submit your meter readings', 'Je meterstanden doorgeven'), q: t('Do I need to submit meter readings?', 'Moet ik meterstanden doorgeven?') },
              ].map((s) => (
                <EdgeCard key={s.l} top={<div className="site-self-icon"><s.icon size={76} strokeWidth={1.6} /></div>} title={s.l} link={s.link} onClick={() => ask(s.q)} />
              ))}
            </div>
            <p className="site-tip">
              {t(`Demo: these tiles open the assistant, which answers or sends you to the right ${brand.portal} page.`, `Demo: deze tegels openen de assistent, die antwoordt of je naar de juiste ${brand.portal}-pagina stuurt.`)}
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-wrap">
          <div className="site-foot-logo">
            <SiteLogo />
          </div>
          <div className="site-foot-grid">
            <div>
              <h4>{t('Quick links', 'Snel Regelen')}</h4>
              <a>{t('Calculate energy costs', 'Energiekosten berekenen')}</a>
              <a>{t('Urgent request', 'Spoedaanvraag')}</a>
              <a onClick={() => navigate('/')}>{brand.portal}</a>
              <a onClick={() => navigate('/mobile-preview')}>{t(`${brand.name} app`, `${brand.name}-app`)}</a>
              <a>{t('Model contract', 'Modelcontract')}</a>
            </div>
            <div>
              <h4>{t('Customer service', 'Klantenservice')}</h4>
              <a onClick={() => ask(t('I want to speak to customer service', 'Ik wil de klantenservice spreken'))}>Contact</a>
              <a onClick={() => ask(t('I am moving house', 'Ik ga verhuizen'))}>{t('Report a move', 'Verhuizing doorgeven')}</a>
              <a onClick={() => ask(t('When is my next payment?', 'Wanneer is mijn volgende betaling?'))}>{t('Invoices and payments', 'Facturen en betalen')}</a>
              <a>{t('Cancellation fee', 'Boetevergoeding')}</a>
              <a onClick={() => ask(t('Do I need to submit meter readings?', 'Moet ik meterstanden doorgeven?'))}>{t('Submit meter readings', 'Meterstanden doorgeven')}</a>
              <a onClick={() => ask(t('How much energy did I use this month?', 'Hoeveel energie heb ik deze maand verbruikt?'))}>{t('Your energy usage', 'Jouw energieverbruik')}</a>
            </div>
            <div>
              <h4>{t(`More ${brand.name}`, `Meer ${brand.name}`)}</h4>
              <a>{t(`About ${brand.name}`, `Over ${brand.name}`)}</a>
              <a>{t('News and knowledge base', 'Nieuws en Kennisbank')}</a>
              <a>{t(`Careers at ${brand.name}`, `Werken bij ${brand.name}`)}</a>
              <a>{t('Fuel mix label', 'Stroometiket')}</a>
              <a>{t('Become a partner', 'Partner worden')}</a>
            </div>
          </div>
          <div className="site-foot-apps">
            <span className="store">
              <small>{t('Get it on', 'Ontdek het op')}</small>Google Play
            </span>
            <span className="store">
              <small>{t('Download on the', 'Download in de')}</small>App Store
            </span>
          </div>
          <div className="site-foot-legal">
            <nav>
              <a>Disclaimer</a>
              <a>Cookie statement</a>
              <a>Privacy statement</a>
              <a>{t('Terms', 'Voorwaarden')}</a>
              <a>{t('Accessibility', 'Toegankelijkheid')}</a>
            </nav>
            <span>{t('Demonstration mock-up, internal use only', 'Demonstratie-mock-up, alleen voor intern gebruik')}</span>
          </div>
        </div>
      </footer>

      <EngieAssistantWidget ref={widget} audience={audience} onAudienceChange={setAudience} onNavigate={(to) => navigate(to)} />
    </div>
  );
}
