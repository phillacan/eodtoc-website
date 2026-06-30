const statusTitle = document.querySelector("#status-title");
const statusBody = document.querySelector("#status-body");
const statusSeverityDot = document.querySelector("#status-severity-dot");
const changelogList = document.querySelector("#changelog-list");

const jsonFetchOptions = {
  cache: "no-store"
};

const severityTypes = new Set(["mild", "fire", "diablo"]);

const loadJson = async (url) => {
  const response = await fetch(url, jsonFetchOptions);

  if (!response.ok) {
    throw new Error(`Unable to load ${url}`);
  }

  return response.json();
};

const formatDate = (timestamp) => {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(date);
};

const normalizeSeverity = (severity) => {
  const normalizedSeverity = String(severity || "").toLowerCase();
  return severityTypes.has(normalizedSeverity) ? normalizedSeverity : "";
};

const renderCurrentStatus = (entries) => {
  const currentStatus = Array.isArray(entries) ? entries[0] : null;

  if (!currentStatus) {
    statusTitle.textContent = "STATUS UNAVAILABLE";
    statusBody.textContent = "Unable to load status data.";
    statusSeverityDot.dataset.severity = "";
    return;
  }

  statusTitle.textContent = currentStatus.title || "";
  statusBody.textContent = currentStatus.body || "";
  statusSeverityDot.dataset.severity = normalizeSeverity(currentStatus.severity);
};

const renderChangelog = (entries) => {
  changelogList.replaceChildren();

  if (!Array.isArray(entries) || entries.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "changelog-empty";
    emptyMessage.textContent = "No changelog entries.";
    changelogList.append(emptyMessage);
    return;
  }

  entries.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "changelog-entry";

    const header = document.createElement("header");
    header.className = "changelog-entry-header";

    const date = document.createElement("time");
    date.className = "changelog-date";

    if (entry.timestamp) {
      date.dateTime = entry.timestamp;
    }

    date.textContent = formatDate(entry.timestamp);
    header.append(date);

    if (entry.version) {
      const version = document.createElement("span");
      version.className = "changelog-version";
      version.textContent = entry.version;
      header.append(version);
    }

    article.append(header);

    if (Array.isArray(entry.changed) && entry.changed.length > 0) {
      const changes = document.createElement("ul");
      changes.className = "changelog-changes";

      entry.changed.forEach((change) => {
        const item = document.createElement("li");
        item.textContent = change;
        changes.append(item);
      });

      article.append(changes);
    }

    if (entry["developer-notes"]) {
      const notesSection = document.createElement("section");
      notesSection.className = "changelog-notes";

      const notesTitle = document.createElement("h3");
      notesTitle.textContent = "DEVELOPER NOTES";
      notesSection.append(notesTitle);

      const notes = document.createElement("p");
      notes.textContent = entry["developer-notes"];
      notesSection.append(notes);

      article.append(notesSection);
    }

    changelogList.append(article);
  });
};

const initStatusPage = async () => {
  try {
    const [statusEntries, changelogEntries] = await Promise.all([
      loadJson("app-status.json"),
      loadJson("changelog.json")
    ]);

    renderCurrentStatus(statusEntries);
    renderChangelog(changelogEntries);
  } catch (error) {
    console.error(error);
    renderCurrentStatus([]);
    renderChangelog([]);
  }
};

initStatusPage();
