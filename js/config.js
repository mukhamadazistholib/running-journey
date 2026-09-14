/* =========================================================
   CONFIGURATION
   =========================================================
   1. Deploy the apps-script/Code.gs file as a Web App
      (see README.md for the full setup steps).
   2. Paste the Web App URL you get below.
   3. Leave it empty ('') if you want to preview the interface
      using example mock data without a Google Sheet.
========================================================= */
const CONFIG = {
 // Example: "https://script.google.com/macros/s/AKfycb.../exec"
  ENDPOINT_URL:
    "https://script.google.com/macros/s/AKfycbzkmq2mPNDBuCeM6eJHeZFEMftWPB3BSrHRy6PXGjoGKPyIhS77I2tqDp3eCqcW2zaz9Q/exec",

  PROFILE: {
    name: "Human",
    bio: "Becoming a little better than yesterday. 🌱",
    photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Pathum",
  },

 // Number of milliseconds between each encouragement bubble appears
  BUBBLE_INTERVAL_MS: 3500,

 // How long each bubble animation lasts from bottom to top (seconds)
  BUBBLE_DURATION_S: 12,
};

/* Example data — automatically used when ENDPOINT_URL is empty */
const MOCK_DATA = {
  events: [
    {
      id: 1,
      icon: "🏃",
      color: "#4c3ae3",
      title: "Morning Run 5K",
     description: "Routine training around the neighborhood",
      time: "07:30 AM",
      status: "done",
    },
    {
      id: 2,
      icon: "🎽",
      color: "#f5a524",
      title: "On-Air Radio App Design",
     description: "UI design for the running event page",
      time: "08:00 AM",
      status: "active",
    },
    {
      id: 3,
      icon: "📩",
      color: "#22c55e",
     title: "Reply to Event Committee Email",
     description: "Confirm the half marathon race pack",
      time: "10:30 AM",
      status: "pending",
    },
    {
      id: 4,
      icon: "💧",
      color: "#3b82f6",
     title: "Pay Registration Fee",
     description: "Settle the race registration cost",
      time: "11:30 AM",
      status: "pending",
    },
    {
      id: 5,
      icon: "🎨",
      color: "#f5a524",
     title: "Design 'Daily UI'",
     description: "Update this week's run route map",
      time: "03:00 PM",
      status: "pending",
    },
    {
      id: 6,
      icon: "📦",
      color: "#ec4899",
     title: "Send Project File",
     description: "Upload the running recap results to the team",
      time: "05:00 PM",
      status: "pending",
    },
  ],
  semangat: [
   { name: "Dinda", message: "Keep pushing, big sis! 🔥" },
   { name: "Anonymous", message: "Almost at the finish line, let's go!" },
   { name: "Bagas", message: "This week's PR is definitely going to break 💪" },
  ],
};
