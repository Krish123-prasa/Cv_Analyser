import { useEffect, useRef, useState } from "react";

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  let response;
  try {
    response = await fetch("/api" + path, {
      credentials: "include",
      ...options,
      headers: {
        ...(isForm ? {} : options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error("Can't reach the app server. Start MongoDB and run `npm run dev`, then try again.");
  }
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const message = data && data.error
      ? data.error
      : response.status >= 500
        ? "The app server is unavailable (HTTP " + response.status + "). Restart it with `npm run dev` and try again."
        : "The request could not be completed (HTTP " + response.status + ").";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true };
  const paths = {
    dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>,
    sparkle: <><path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" /><path d="m19 3 .7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7L19 3Z" /></>,
    file: <><path d="M6 3.8h8l4 4v12.4H6a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" /><path d="M14 4v4h4M8 13h8M8 16.5h5" /></>,
    chart: <><path d="M4 19V5m0 14h16" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>,
    upload: <><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4" /></>,
    download: <><path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 20h14" /></>,
    trash: <><path d="M4 7h16M10 11v5m4-5v5M5.5 7l1 13h11l1-13M9 7V4h6v3" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8" /></>,
    person: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>
  };
  return <svg {...common} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.file}</svg>;
}

function Brand({ compact = false }) {
  return (
    <div className={"brand" + (compact ? " brand-compact" : "")}>
      <span className="brand-symbol">E</span>
      <span>Elevate<span className="brand-period">.</span><small>RESUME STUDIO</small></span>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function fileSize(bytes) {
  if (!bytes) return "—";
  return bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await request("/auth/" + mode, {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow">A more considered career</span>
          <h1>Make your experience<br />{" "}work harder.</h1>
          <p>Thoughtful, job-specific resumes begin with the story you already have.</p>
        </div>
        <div className="story-quote">
          <span className="quote-rule" />
          <p>“A good resume doesn't say everything. It says the right things, clearly.”</p>
          <span className="quote-credit">THE ELEVATE APPROACH</span>
        </div>
        <span className="story-footnote">PRIVATE BY DESIGN · YOUR DOCUMENTS STAY YOURS</span>
      </section>
      <section className="auth-form-side">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand compact /></div>
          <span className="eyebrow">{isRegister ? "A fine place to begin" : "Welcome back"}</span>
          <h2>{isRegister ? "Create your account" : "Sign in to your studio"}</h2>
          <p className="auth-intro">{isRegister ? "Set up your private resume workspace." : "Your next opportunity is waiting to take shape."}</p>
          <form onSubmit={submit} className="auth-form">
            {isRegister && <label>Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="80" required /></label>}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" maxLength="128" required /><span className="field-note">{isRegister ? "Use at least 8 characters." : "Your password is securely encrypted."}</span></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-dark button-wide" type="submit" disabled={busy}>{busy ? "One moment…" : isRegister ? "Create my account" : "Sign in"} <Icon name="arrow" size={16} /></button>
          </form>
          <p className="auth-switch">{isRegister ? "Already have an account?" : "New to Elevate?"} <button type="button" onClick={() => { setError(""); setMode(isRegister ? "login" : "register"); }}> {isRegister ? "Sign in" : "Create an account"}</button></p>
          <p className="privacy-note"><Icon name="lock" size={14} /> Your resume files are private and accessible only to you.</p>
        </div>
      </section>
    </main>
  );
}

function ProfilePage({ user, onSaved }) {
  const [profile, setProfile] = useState(user);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setProfile(user);
  }, [user]);

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function updateEducation(index, field, value) {
    setProfile((current) => ({
      ...current,
      education: current.education.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry)
    }));
    setMessage("");
  }

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const data = await request("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          userType: profile.userType,
          headline: profile.headline,
          phone: profile.phone,
          location: profile.location,
          linkedin: profile.linkedin,
          portfolio: profile.portfolio,
          education: profile.education
        })
      });
      onSaved(data.user);
      setMessage("Your profile has been saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view-section">
      <div className="page-heading">
        <div><span className="eyebrow">YOUR DETAILS, YOURS TO MANAGE</span><h1>Your profile.</h1><p>Keep your contact details and academic background current for every application.</p></div>
      </div>
      <form className="profile-form" onSubmit={saveProfile}>
        <section className="panel profile-card">
          <div className="profile-section-heading"><span className="form-step"><Icon name="person" size={15} /></span><div><h2>Personal details</h2><p>These details are private to your account.</p></div></div>
          <div className="profile-fields">
            <label className="profile-field">Full name<input className="text-input" value={profile.name || ""} onChange={(event) => updateField("name", event.target.value)} minLength="2" maxLength="80" autoComplete="name" required /></label>
            <label className="profile-field">Email address<input className="text-input" type="email" value={profile.email || ""} onChange={(event) => updateField("email", event.target.value)} maxLength="254" autoComplete="email" required /></label>
            <label className="profile-field">I am a<select className="text-input" value={profile.userType || "other"} onChange={(event) => updateField("userType", event.target.value)}><option value="student">Student</option><option value="graduate">Graduate</option><option value="professional">Working professional</option><option value="other">Other</option></select></label>
            <label className="profile-field">Professional headline<input className="text-input" value={profile.headline || ""} onChange={(event) => updateField("headline", event.target.value)} maxLength="160" placeholder="e.g. Information Technology student" /></label>
            <label className="profile-field">Phone<input className="text-input" type="tel" value={profile.phone || ""} onChange={(event) => updateField("phone", event.target.value)} maxLength="40" autoComplete="tel" /></label>
            <label className="profile-field">Location<input className="text-input" value={profile.location || ""} onChange={(event) => updateField("location", event.target.value)} maxLength="120" autoComplete="address-level2" /></label>
            <label className="profile-field">LinkedIn profile<input className="text-input" value={profile.linkedin || ""} onChange={(event) => updateField("linkedin", event.target.value)} maxLength="240" placeholder="linkedin.com/in/your-profile" /></label>
            <label className="profile-field">Portfolio or website<input className="text-input" value={profile.portfolio || ""} onChange={(event) => updateField("portfolio", event.target.value)} maxLength="240" placeholder="your-portfolio.example" /></label>
          </div>
        </section>

        <section className="panel profile-card">
          <div className="profile-section-heading"><span className="form-step"><Icon name="book" size={15} /></span><div><h2>Academic credentials</h2><p>Add degrees, training, or other education. All fields are optional.</p></div></div>
          <div className="education-list">
            {profile.education.map((entry, index) => (
              <fieldset className="education-entry" key={index}>
                <legend>Education {index + 1}</legend>
                <button className="education-remove" type="button" onClick={() => updateField("education", profile.education.filter((_item, entryIndex) => entryIndex !== index))} aria-label={"Remove education " + (index + 1)}>Remove</button>
                <div className="profile-fields">
                  <label className="profile-field">Degree or credential<input className="text-input" value={entry.degree || ""} onChange={(event) => updateEducation(index, "degree", event.target.value)} maxLength="120" placeholder="e.g. Bachelor of Technology" /></label>
                  <label className="profile-field">Field of study<input className="text-input" value={entry.field || ""} onChange={(event) => updateEducation(index, "field", event.target.value)} maxLength="120" placeholder="e.g. Computer Science" /></label>
                  <label className="profile-field profile-field-full">Institution<input className="text-input" value={entry.institution || ""} onChange={(event) => updateEducation(index, "institution", event.target.value)} maxLength="160" /></label>
                  <label className="profile-field">Start year<input className="text-input" value={entry.startYear || ""} onChange={(event) => updateEducation(index, "startYear", event.target.value)} maxLength="10" placeholder="e.g. 2022" /></label>
                  <label className="profile-field">End year<input className="text-input" value={entry.endYear || ""} onChange={(event) => updateEducation(index, "endYear", event.target.value)} maxLength="10" placeholder="e.g. 2026 or Present" /></label>
                  <label className="profile-field profile-field-full">Additional details<textarea className="text-input education-details" value={entry.details || ""} onChange={(event) => updateEducation(index, "details", event.target.value)} maxLength="500" placeholder="Optional honors, GPA, coursework, or achievements" /></label>
                </div>
              </fieldset>
            ))}
          </div>
          <button className="button button-outline" type="button" disabled={profile.education.length >= 12} onClick={() => updateField("education", [...profile.education, { degree: "", field: "", institution: "", startYear: "", endYear: "", details: "" }])}><Icon name="plus" size={15} /> Add education</button>
        </section>

        {message && <p className={"profile-message" + (message.includes("saved") ? " profile-message-success" : "")} role="status">{message}</p>}
        <div className="profile-save-row"><span>Your email is also your sign-in address.</span><button className="button button-dark" type="submit" disabled={busy}>{busy ? "Saving profile…" : "Save profile"} <Icon name="check" size={15} /></button></div>
      </form>
    </section>
  );
}

function ScoreRing({ score, size = "large" }) {
  const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
  return <div className={"score-ring " + size} style={{ "--score": (safeScore * 3.6) + "deg" }}><span><strong>{safeScore}</strong><small>match</small></span></div>;
}

function AnalysisResult({ analysis }) {
  if (!analysis) return null;
  return (
    <section className="analysis-result" aria-live="polite">
      <div className="analysis-head">
        <ScoreRing score={analysis.score} />
        <div><span className="eyebrow">{analysis.mode === "ai" ? "AI REVIEW" : "KEYWORD REVIEW"}</span><h3>Your match, at a glance</h3><p>{analysis.summary}</p></div>
      </div>
      <div className="analysis-columns">
        <div className="analysis-list">
          <h4><span className="list-marker matched"><Icon name="check" size={13} /></span>Already in your resume <small>{analysis.matchedSkills.length}</small></h4>
          {analysis.matchedSkills.length ? <ul>{analysis.matchedSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p className="subtle-copy">No direct matches detected yet.</p>}
        </div>
        <div className="analysis-list">
          <h4><span className="list-marker gap">!</span>Not found in resume text <small>{analysis.missingSkills.length}</small></h4>
          {analysis.missingSkills.length ? <ul>{analysis.missingSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p className="subtle-copy">No gaps found in the detected requirements.</p>}
        </div>
      </div>
      {analysis.recommendations.length > 0 && <div className="recommendations"><h4>Ways to strengthen your application</h4><ul>{analysis.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    </section>
  );
}

function ResumeCard({ resume, onDelete }) {
  return (
    <article className="resume-card">
      <div className="document-mark"><Icon name="file" size={20} /><span>DOC</span></div>
      <div className="resume-card-main">
        <h3>{resume.title}</h3>
        <p>{resume.originalName} · {fileSize(resume.size)}</p>
        <span className="resume-date"><Icon name="clock" size={13} /> Added {formatDate(resume.createdAt)}</span>
      </div>
      {resume.lastAnalysis && <div className="compact-score"><strong>{resume.lastAnalysis.score}</strong><span>last match</span></div>}
      <div className="card-actions">
        <a className="small-action" href={"/api/resumes/" + resume.id + "/download"} title="Download original resume" aria-label={"Download " + resume.title}><Icon name="download" size={16} /></a>
        <button className="small-action danger-action" type="button" onClick={() => onDelete(resume, "resume")} title="Delete resume" aria-label={"Delete " + resume.title}><Icon name="trash" size={16} /></button>
      </div>
    </article>
  );
}

function OptimizationCard({ item, onDelete }) {
  const outputFormat = item.outputFormat === "docx" ? "DOCX" : "PDF";
  return (
    <article className="resume-card tailored-card">
      <div className="document-mark tailored-mark"><Icon name="sparkle" size={19} /><span>{outputFormat}</span></div>
      <div className="resume-card-main">
        <h3>{item.title}</h3>
        <p>{item.sourceTitle || "Resume"} · {outputFormat} · {item.mode === "ai" ? "AI-assisted edition" : "Local keyword mode"}</p>
        <span className="resume-date"><Icon name="clock" size={13} /> Created {formatDate(item.createdAt)}</span>
      </div>
      <div className="compact-score"><strong>{item.analysis?.score ?? "—"}</strong><span>match</span></div>
      <div className="card-actions">
        <a className="small-action" href={"/api/optimizations/" + item.id + "/download"} title={"Download tailored resume as " + outputFormat} aria-label={"Download " + item.title}><Icon name="download" size={16} /></a>
        <button className="small-action danger-action" type="button" onClick={() => onDelete(item, "optimization")} title="Delete tailored resume" aria-label={"Delete " + item.title}><Icon name="trash" size={16} /></button>
      </div>
    </article>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("overview");
  const [resumes, setResumes] = useState([]);
  const [optimizations, setOptimizations] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [tailoredText, setTailoredText] = useState("");
  const [tailoredId, setTailoredId] = useState("");
  const [tailoredMode, setTailoredMode] = useState("");
  const [tailoredFormat, setTailoredFormat] = useState("pdf");
  const [exportFormat, setExportFormat] = useState("docx");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const uploadInput = useRef(null);

  const scoreList = resumes.map((resume) => resume.lastAnalysis?.score).filter((score) => Number.isFinite(score));
  const averageScore = scoreList.length ? Math.round(scoreList.reduce((total, score) => total + score, 0) / scoreList.length) : "—";

  useEffect(() => {
    request("/auth/me")
      .then((data) => setUser(data.user))
      .catch((error) => { if (error.status !== 401) setWorkspaceError(error.message); })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setResumes([]);
      setOptimizations([]);
      return;
    }
    let active = true;
    setWorkspaceLoading(true);
    Promise.all([request("/resumes"), request("/optimizations")])
      .then(([resumeData, optimizationData]) => {
        if (!active) return;
        setResumes(resumeData.resumes);
        setOptimizations(optimizationData.optimizations);
      })
      .catch((error) => { if (active) setWorkspaceError(error.message); })
      .finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; };
  }, [user]);

  async function refreshLibrary() {
    const [resumeData, optimizationData] = await Promise.all([request("/resumes"), request("/optimizations")]);
    setResumes(resumeData.resumes);
    setOptimizations(optimizationData.optimizations);
  }

  async function signOut() {
    setBusy("logout");
    try {
      await request("/auth/logout", { method: "POST" });
      setUser(null);
      setView("overview");
      setNotice("");
      setWorkspaceError("");
      setSelectedResumeId("");
      setResumeFile(null);
      setRole("");
      setJobDescription("");
      setAnalysis(null);
      setTailoredText("");
      setTailoredId("");
      setTailoredMode("");
      setTailoredFormat("pdf");
      setReviewConfirmed(false);
    } catch (error) {
      setWorkspaceError(error.message);
    } finally {
      setBusy("");
    }
  }

  function startOptimizing() {
    setView("optimize");
    setNotice("");
  }

  function clearReview() {
    setAnalysis(null);
    setTailoredText("");
    setTailoredId("");
    setTailoredMode("");
    setTailoredFormat("pdf");
    setReviewConfirmed(false);
  }

  function clearGeneratedResume() {
    setTailoredText("");
    setTailoredId("");
    setTailoredMode("");
    setTailoredFormat("pdf");
    setReviewConfirmed(false);
  }

  async function analyze(event) {
    event.preventDefault();
    setNotice("");
    setAnalysis(null);
    setTailoredText("");
    setTailoredId("");
    setTailoredMode("");
    setTailoredFormat("pdf");
    setReviewConfirmed(false);
    setBusy("analysis");
    try {
      let resumeId = selectedResumeId;
      if (resumeFile) {
        const formData = new FormData();
        formData.append("resume", resumeFile);
        const uploaded = await request("/resumes", { method: "POST", body: formData });
        resumeId = uploaded.resume.id;
        setSelectedResumeId(resumeId);
        setResumeFile(null);
        await refreshLibrary();
      }
      if (!resumeId) throw new Error("Upload a resume or choose one from your library.");
      const data = await request("/resumes/" + resumeId + "/analyze", {
        method: "POST",
        body: JSON.stringify({ role, jobDescription })
      });
      setAnalysis(data.analysis);
      setNotice(data.analysis.mode === "keyword"
        ? "Review complete using local keyword matching. Add an AI provider in .env for deeper recommendations."
        : "AI review complete. Check every suggestion for accuracy before applying it.");
      await refreshLibrary();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }

  async function generateResume() {
    if (!selectedResumeId) return;
    setNotice("");
    setBusy("generation");
    try {
      const data = await request("/optimizations", {
        method: "POST",
        body: JSON.stringify({ resumeId: selectedResumeId, role, jobDescription, outputFormat: exportFormat })
      });
      setTailoredText(data.content);
      setTailoredId(data.optimization.id);
      setTailoredMode(data.optimization.mode);
      setTailoredFormat(data.optimization.outputFormat || "pdf");
      setReviewConfirmed(false);
      setNotice(data.changed
        ? data.optimization.mode === "keyword"
          ? "Local tailoring prioritized matching details already in your resume without adding new claims. Review the preview and job-match details."
          : "AI-assisted resume created. Review every detail before applying."
        : data.optimization.mode === "keyword"
          ? "No safe local content changes matched this job description. Configure an AI provider for more specific phrasing; no details were invented."
          : "No content edits were returned. Review the source resume and job description, then try again.");
      await refreshLibrary();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteItem(item, kind) {
    if (!window.confirm("Delete “" + item.title + (kind === "resume" ? "” and its tailored versions?" : "”?"))) return;
    const endpoint = kind === "resume" ? "/resumes/" : "/optimizations/";
    try {
      await request(endpoint + item.id, { method: "DELETE" });
      await refreshLibrary();
      if (kind === "resume" && selectedResumeId === item.id) {
        setSelectedResumeId("");
        clearReview();
      }
      setNotice(kind === "resume" ? "Resume and tailored versions deleted." : "Tailored resume deleted.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  if (authLoading) return <div className="loading-screen"><Brand /><span>Opening your studio…</span></div>;
  if (!user) return <AuthScreen onAuthenticated={(authenticated) => { setWorkspaceError(""); setUser(authenticated); }} />;

  const navItems = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "optimize", label: "Resume optimizer", icon: "sparkle" },
    { id: "library", label: "Resume library", icon: "file" },
    { id: "profile", label: "Profile", icon: "person" }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="side-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => <button key={item.id} className={"nav-item" + (view === item.id ? " active" : "")} type="button" onClick={() => { setView(item.id); setNotice(""); }}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.id === "library" && resumes.length > 0 && <small>{resumes.length}</small>}</button>)}
        </nav>
        <div className="sidebar-note">
          <span className="note-seal"><Icon name="lock" size={16} /></span>
          <strong>A private workspace</strong>
          <p>Your uploaded resumes are visible only to you.</p>
        </div>
        <div className="profile-strip">
          <span className="user-initials">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
          <span className="user-details"><strong>{user.name}</strong><small>{user.email}</small></span>
          <button className="signout-button" onClick={signOut} type="button" disabled={busy === "logout"} title="Sign out" aria-label="Sign out"><Icon name="logout" size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">Studio <span>/</span> <strong>{navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-right"><span className="today-date">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span><span className="topbar-divider" /><button className="avatar-small avatar-button" type="button" onClick={() => setView("profile")} title="Open your profile" aria-label="Open your profile">{user.name.charAt(0).toUpperCase()}</button></div>
        </header>

        <div className="page-content">
          {(notice || workspaceError) && <div className={"notice " + (workspaceError ? "notice-error" : "")} role="status"><span>{workspaceError || notice}</span><button type="button" onClick={() => { setNotice(""); setWorkspaceError(""); }} aria-label="Dismiss">×</button></div>}
          {view === "overview" && (
            <section className="view-section">
              <div className="page-heading overview-heading">
                <div><span className="eyebrow">YOUR CAREER, THOUGHTFULLY PRESENTED</span><h1>Good morning, {user.name.split(" ")[0]}.</h1><p>Bring the right parts of your experience forward for every opportunity.</p></div>
                <button className="button button-dark" onClick={startOptimizing} type="button"><Icon name="plus" size={16} /> Tailor a resume</button>
              </div>
              <div className="metric-grid">
                <article className="metric-card"><span className="metric-caption">SOURCE RESUMES</span><strong>{resumes.length}</strong><span className="metric-sub">Your original documents</span><span className="metric-icon"><Icon name="file" size={20} /></span></article>
                <article className="metric-card"><span className="metric-caption">TAILORED VERSIONS</span><strong>{optimizations.length}</strong><span className="metric-sub">Saved for specific roles</span><span className="metric-icon"><Icon name="book" size={20} /></span></article>
                <article className="metric-card"><span className="metric-caption">AVERAGE KEYWORD MATCH</span><strong>{averageScore}{averageScore !== "—" && <small>/100</small>}</strong><span className="metric-sub">{scoreList.length ? "Across analyzed resumes" : "Analyze a resume to begin"}</span><span className="metric-icon"><Icon name="chart" size={20} /></span></article>
              </div>
              <div className="overview-grid">
                <section className="panel welcome-panel">
                  <div className="panel-kicker"><span className="kicker-line" /> A NOTE FROM YOUR STUDIO</div>
                  <h2>A good next step<br />starts with a good story.</h2>
                  <p>Compare your experience with a job description, find skills that may need attention, and create a version of your resume that puts relevant work in view.</p>
                  <button className="text-link" type="button" onClick={startOptimizing}>Begin with a job description <Icon name="arrow" size={15} /></button>
                  <div className="panel-watermark">E</div>
                </section>
                <section className="panel recent-panel">
                  <div className="panel-title-row"><div><span className="eyebrow">KEPT CLOSE AT HAND</span><h2>Recent work</h2></div><button className="text-link" type="button" onClick={() => setView("library")}>The library <Icon name="arrow" size={14} /></button></div>
                  {workspaceLoading ? <p className="empty-copy">Gathering your documents…</p> : optimizations.length ? <div className="recent-list">{optimizations.slice(0, 3).map((item) => <div className="recent-item" key={item.id}><span className="recent-mark"><Icon name="sparkle" size={16} /></span><span className="recent-item-copy"><strong>{item.title}</strong><small>{formatDate(item.createdAt)} · {item.sourceTitle}</small></span><strong className="recent-score">{item.analysis?.score ?? "—"}</strong></div>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="book" size={20} /></span><strong>Your tailored resumes will live here.</strong><p>Start with a source resume and a job listing.</p><button className="text-link" type="button" onClick={startOptimizing}>Create your first version <Icon name="arrow" size={14} /></button></div>}
                </section>
              </div>
              <section className="footnote-strip"><Icon name="lock" size={14} /><span>Resume text is stored in your private account. AI analysis is sent to your configured provider only when you choose to analyze or generate.</span></section>
            </section>
          )}

          {view === "optimize" && (
            <section className="view-section">
              <div className="page-heading">
                <div><span className="eyebrow">A PURPOSEFUL EDITION</span><h1>Tailor your resume.</h1><p>Pair your experience with the work a role asks for.</p></div>
                <span className="process-note"><span>01</span> Add a role <i /> <span>02</span> Review your match</span>
              </div>
              <form className="optimizer-layout" onSubmit={analyze}>
                <div className="optimizer-main">
                  <section className="panel form-panel">
                    <div className="form-section-heading"><span className="form-step">01</span><div><h2>Choose your source resume</h2><p>Upload an original document or select one from your library.</p></div></div>
                    <label className="field-label" htmlFor="saved-resume">Saved resume</label>
                    <select id="saved-resume" className="text-input" value={selectedResumeId} onChange={(event) => { setSelectedResumeId(event.target.value); setResumeFile(null); if (uploadInput.current) uploadInput.current.value = ""; clearReview(); }}>
                      <option value="">Choose a saved resume…</option>
                      {resumes.map((resume) => <option value={resume.id} key={resume.id}>{resume.title} · {resume.originalName}</option>)}
                    </select>
                    <div className="or-divider"><span>OR UPLOAD A NEW RESUME</span></div>
                    <label className={"dropzone" + (resumeFile ? " has-file" : "")} htmlFor="resume-upload">
                      <span className="upload-stamp"><Icon name={resumeFile ? "check" : "upload"} size={20} /></span>
                      <strong>{resumeFile ? resumeFile.name : "Choose a resume to begin"}</strong>
                      <small>{resumeFile ? fileSize(resumeFile.size) + " · Ready to upload" : "PDF or DOCX, up to 10 MB. Text is extracted securely on the server."}</small>
                      <span className="browse-link">{resumeFile ? "Choose another file" : "Browse files"}</span>
                      <input ref={uploadInput} id="resume-upload" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const selected = event.target.files[0]; setResumeFile(selected || null); event.target.value = ""; if (selected) { setSelectedResumeId(""); clearReview(); } }} />
                    </label>
                    <div className="privacy-callout"><Icon name="lock" size={15} /><span>Files are private to your account. The extracted text is never shown to other users.</span></div>
                  </section>

                  <section className="panel form-panel">
                    <div className="form-section-heading"><span className="form-step">02</span><div><h2>Tell us about the opportunity</h2><p>Use the role's own language for a more useful comparison.</p></div></div>
                    <label className="field-label" htmlFor="role-name">Target job title <span>OPTIONAL</span></label>
                    <input id="role-name" className="text-input" type="text" maxLength="120" placeholder="e.g. Product Designer" value={role} onChange={(event) => { setRole(event.target.value); clearReview(); }} />
                    <label className="field-label description-label" htmlFor="download-format">Preferred download format</label>
                    <select id="download-format" className="text-input" value={exportFormat} onChange={(event) => { setExportFormat(event.target.value); clearGeneratedResume(); }}>
                      <option value="docx">Word document (.docx)</option>
                      <option value="pdf">PDF (.pdf)</option>
                    </select>
                    <label className="field-label description-label" htmlFor="job-description">Job description <span>30–20,000 CHARACTERS</span></label>
                    <textarea id="job-description" className="text-input job-description" minLength="30" maxLength="20000" required placeholder="Paste the job description here. Include responsibilities, qualifications, and skills…" value={jobDescription} onChange={(event) => { setJobDescription(event.target.value); clearReview(); }} />
                    <div className="character-count">{jobDescription.length.toLocaleString()} / 20,000</div>
                    <button className="button button-dark button-wide analyze-button" type="submit" disabled={Boolean(busy)}><Icon name="sparkle" size={16} />{busy === "analysis" ? "Reviewing your experience…" : "Analyze the match"}<Icon name="arrow" size={15} /></button>
                  </section>
                </div>

                <aside className="optimizer-aside">
                  <section className="panel guidance-panel">
                    <span className="eyebrow">THE ELEVATE METHOD</span>
                    <h3>Specific, never overstated.</h3>
                    <p>Your experience stays the source of truth. Suggestions surface relevant work—they should never add claims you can't support.</p>
                    <div className="guidance-divider" />
                    <div className="guidance-point"><span>1</span><p><strong>Compare</strong> relevant skills and language.</p></div>
                    <div className="guidance-point"><span>2</span><p><strong>Consider</strong> potential gaps before applying.</p></div>
                    <div className="guidance-point"><span>3</span><p><strong>Review</strong> every generated change.</p></div>
                  </section>
                  {analysis && !tailoredText && <AnalysisResult analysis={analysis} />}
                  {analysis && !tailoredText && <button className="button button-outline button-wide generate-button" type="button" onClick={generateResume} disabled={Boolean(busy)}><Icon name="sparkle" size={16} />{busy === "generation" ? "Preparing your edition…" : "Create tailored resume"}</button>}
                </aside>
              </form>
              {tailoredText && <section className="panel tailored-review" aria-labelledby="tailored-review-title">
                <div className="tailored-review-heading">
                  <div><span className="eyebrow">REVIEW BEFORE YOU DOWNLOAD · {tailoredMode === "ai" ? "AI-ASSISTED" : "LOCAL KEYWORD"} · {tailoredFormat.toUpperCase()}</span><h2 id="tailored-review-title">Your optimized resume</h2><p>Check the resume layout and compare its content with the job requirements before downloading.</p></div>
                </div>
                <div className="tailored-review-grid">
                  <div className="tailored-review-details">
                    <AnalysisResult analysis={analysis} />
                    <section className="ats-checks">
                      <span className="eyebrow">READABILITY CHECKS</span>
                      <h3>ATS-friendly basics</h3>
                      <ul>
                        <li><Icon name="check" size={14} /> Text-based {tailoredFormat.toUpperCase()} output</li>
                        <li><Icon name="check" size={14} /> Source section order and headings retained</li>
                        <li><Icon name="check" size={14} /> Job keywords compared with your source resume</li>
                      </ul>
                      <p>The match score reflects detected job requirements; it is not a score from an employer's ATS.</p>
                    </section>
                  </div>
                  <div className="tailored-document">
                    <div className="tailored-document-heading"><span>PDF PREVIEW · DOWNLOAD AS {tailoredFormat.toUpperCase()}</span><strong>{role || "Tailored resume"}</strong></div>
                    <iframe key={tailoredId} title="Optimized resume PDF preview" src={"/api/optimizations/" + tailoredId + "/preview#toolbar=0&navpanes=0&view=FitH"} />
                  </div>
                </div>
                <div className="tailored-review-footer">
                  <div className="review-confirmation"><label><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} /><span>I reviewed this resume and confirmed the details are accurate.</span></label><p>Missing requirements are shown above. Never add skills or experience you cannot substantiate.</p></div>
                  <a className={"button button-dark" + (reviewConfirmed ? "" : " button-disabled")} href={"/api/optimizations/" + tailoredId + "/download"} aria-disabled={!reviewConfirmed} onClick={(event) => { if (!reviewConfirmed) event.preventDefault(); }}><Icon name="download" size={16} /> Download {tailoredFormat === "docx" ? "Word document" : "PDF"}</a>
                </div>
              </section>}
            </section>
          )}

          {view === "library" && (
            <section className="view-section">
              <div className="page-heading library-heading">
                <div><span className="eyebrow">YOUR WORK, WELL KEPT</span><h1>Resume library.</h1><p>Original documents and the tailored editions you've created.</p></div>
                <button className="button button-dark" type="button" onClick={startOptimizing}><Icon name="plus" size={16} /> New tailored resume</button>
              </div>
              <section className="library-section">
                <div className="library-section-heading"><div><span className="section-index">I</span><h2>Source resumes</h2><span className="item-count">{resumes.length}</span></div><p>Original documents you uploaded</p></div>
                {resumes.length ? <div className="resume-grid">{resumes.map((resume) => <ResumeCard key={resume.id} resume={resume} onDelete={deleteItem} />)}</div> : <div className="library-empty"><span className="empty-icon"><Icon name="file" size={20} /></span><h3>No source resumes yet.</h3><p>Upload a PDF or DOCX to begin creating job-specific versions.</p><button className="text-link" type="button" onClick={startOptimizing}>Upload a resume <Icon name="arrow" size={14} /></button></div>}
              </section>
              <section className="library-section">
                <div className="library-section-heading"><div><span className="section-index">II</span><h2>Tailored editions</h2><span className="item-count">{optimizations.length}</span></div><p>One carefully adapted resume for each opportunity</p></div>
                {optimizations.length ? <div className="resume-grid">{optimizations.map((item) => <OptimizationCard key={item.id} item={item} onDelete={deleteItem} />)}</div> : <div className="library-empty compact-empty"><span className="empty-icon"><Icon name="sparkle" size={20} /></span><h3>Your tailored editions will appear here.</h3><p>Analyze a job match and create a reviewed version for each role.</p></div>}
              </section>
            </section>
          )}

          {view === "profile" && <ProfilePage user={user} onSaved={(updatedUser) => setUser(updatedUser)} />}
        </div>
      </main>
    </div>
  );
}

export default App;
