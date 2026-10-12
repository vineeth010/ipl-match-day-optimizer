/** Team colours and short codes. These are our own colour chips, not club logos or branding. */
export interface TeamStyle {
  code: string;
  bg: string;
  fg: string;
  short: string;
  /** official logo, supplied by the user at public/teams/<CODE>.png (falls back to the colour badge) */
  logo: string;
}

const TEAMS: Record<string, TeamStyle> = {
  "Chennai Super Kings": { code: "CSK", short: "Super Kings", bg: "#F9CD05", fg: "#1a2a6c", logo: "/teams/CSK.png" },
  "Mumbai Indians": { code: "MI", short: "Indians", bg: "#005DA0", fg: "#ffffff", logo: "/teams/MI.png" },
  "Royal Challengers Bengaluru": { code: "RCB", short: "Challengers", bg: "#C8102E", fg: "#ffffff", logo: "/teams/RCB.png" },
  "Royal Challengers Bangalore": { code: "RCB", short: "Challengers", bg: "#C8102E", fg: "#ffffff", logo: "/teams/RCB.png" },
  "Kolkata Knight Riders": { code: "KKR", short: "Knight Riders", bg: "#3B2A72", fg: "#F2C94C", logo: "/teams/KKR.png" },
  "Sunrisers Hyderabad": { code: "SRH", short: "Sunrisers", bg: "#F26522", fg: "#111827", logo: "/teams/SRH.png" },
  "Delhi Capitals": { code: "DC", short: "Capitals", bg: "#17479E", fg: "#ffffff", logo: "/teams/DC.png" },
  "Rajasthan Royals": { code: "RR", short: "Royals", bg: "#E91E8C", fg: "#ffffff", logo: "/teams/RR.png" },
  "Punjab Kings": { code: "PBKS", short: "Kings", bg: "#C8102E", fg: "#ffffff", logo: "/teams/PBKS.png" },
  "Gujarat Titans": { code: "GT", short: "Titans", bg: "#1C2C5B", fg: "#C7A24A", logo: "/teams/GT.png" },
  "Lucknow Super Giants": { code: "LSG", short: "Super Giants", bg: "#00A3E0", fg: "#ffffff", logo: "/teams/LSG.png" },
};

export function teamStyle(name: string): TeamStyle {
  return TEAMS[name] ?? { code: name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase(), short: name, bg: "#334155", fg: "#ffffff", logo: "" };
}
