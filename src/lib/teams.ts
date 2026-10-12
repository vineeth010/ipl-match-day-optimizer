/** Team colours and short codes. These are our own colour chips, not club logos or branding. */
export interface TeamStyle {
  code: string;
  bg: string;
  fg: string;
  short: string;
}

const TEAMS: Record<string, TeamStyle> = {
  "Chennai Super Kings": { code: "CSK", short: "Super Kings", bg: "#F9CD05", fg: "#1a2a6c" },
  "Mumbai Indians": { code: "MI", short: "Indians", bg: "#005DA0", fg: "#ffffff" },
  "Royal Challengers Bengaluru": { code: "RCB", short: "Challengers", bg: "#C8102E", fg: "#ffffff" },
  "Royal Challengers Bangalore": { code: "RCB", short: "Challengers", bg: "#C8102E", fg: "#ffffff" },
  "Kolkata Knight Riders": { code: "KKR", short: "Knight Riders", bg: "#3B2A72", fg: "#F2C94C" },
  "Sunrisers Hyderabad": { code: "SRH", short: "Sunrisers", bg: "#F26522", fg: "#111827" },
  "Delhi Capitals": { code: "DC", short: "Capitals", bg: "#17479E", fg: "#ffffff" },
  "Rajasthan Royals": { code: "RR", short: "Royals", bg: "#E91E8C", fg: "#ffffff" },
  "Punjab Kings": { code: "PBKS", short: "Kings", bg: "#C8102E", fg: "#ffffff" },
  "Gujarat Titans": { code: "GT", short: "Titans", bg: "#1C2C5B", fg: "#C7A24A" },
  "Lucknow Super Giants": { code: "LSG", short: "Super Giants", bg: "#00A3E0", fg: "#ffffff" },
};

export function teamStyle(name: string): TeamStyle {
  return TEAMS[name] ?? { code: name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase(), short: name, bg: "#334155", fg: "#ffffff" };
}
