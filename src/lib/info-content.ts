export type InfoPage = {
  short: string;
  title: string;
  tagline: string;
  sections: { heading: string; body: string[] }[];
};

export const INFO_PAGES: Record<string, InfoPage> = {
  about: {
    short: "About",
    title: "About RiseUp",
    tagline: "A video platform built for people who are actually trying to get better.",
    sections: [
      {
        heading: "Why we exist",
        body: [
          "RiseUp is a video platform for discipline, training, study and building. Long-form episodes and vertical shorts live side by side, ranked by what genuinely helps you improve rather than what keeps you scrolling the longest.",
          "Every creator on RiseUp keeps ownership of their work, earns tokens for consistent uploading, and can sell digital products directly to their audience without a middleman.",
        ],
      },
      {
        heading: "What makes it different",
        body: [
          "Streak-based accountability: your consistency is part of your profile, not hidden in an analytics tab.",
          "A token economy where viewers can buy a creator's products with tokens they earned by showing up.",
          "Rooms for live accountability groups, and an Arena leaderboard that ranks operators by real reach.",
        ],
      },
    ],
  },
  press: {
    short: "Press",
    title: "Press & media",
    tagline: "Facts, assets and contacts for journalists covering RiseUp.",
    sections: [
      {
        heading: "The short version",
        body: [
          "RiseUp is an independent creator platform combining long-form video, vertical shorts, live accountability rooms and creator-owned digital storefronts.",
          "Videos are encoded to H.264 renditions in the uploader's own browser, which keeps distribution costs near zero and lets the platform stay independent.",
        ],
      },
      {
        heading: "Media requests",
        body: [
          "For interviews, product briefings or brand assets, email press@riseup.media with your outlet, deadline and the angle you're working on. We answer press mail before anything else.",
        ],
      },
    ],
  },
  copyright: {
    short: "Copyright",
    title: "Copyright",
    tagline: "How ownership, claims and counter-notices work on RiseUp.",
    sections: [
      {
        heading: "You own what you upload",
        body: [
          "Uploading to RiseUp grants us a licence to host, encode and stream your video so viewers can watch it. It does not transfer ownership. Delete a video and that licence ends.",
        ],
      },
      {
        heading: "Reporting infringement",
        body: [
          "If content on RiseUp infringes your copyright, send a notice to copyright@riseup.media including the exact video URL, a description of the original work, your contact details and a statement made in good faith.",
          "Uploaders are notified of every claim and can file a counter-notice. Repeat infringement leads to channel termination.",
        ],
      },
      {
        heading: "Remixes",
        body: [
          "The Remix button attributes the original creator automatically and tags the derivative video. Attribution is not a substitute for permission when you reuse substantial footage.",
        ],
      },
    ],
  },
  contact: {
    short: "Contact us",
    title: "Contact us",
    tagline: "Real humans, sorted by what you need.",
    sections: [
      {
        heading: "Support",
        body: [
          "Upload problems, playback issues, token balances or purchases: support@riseup.media. Include your @handle and the video or product link.",
        ],
      },
      {
        heading: "Trust & safety",
        body: [
          "To report harmful content, harassment or an account impersonating you: safety@riseup.media. Reports are triaged within 24 hours.",
        ],
      },
      {
        heading: "Business",
        body: [
          "Partnerships, advertising and creator programmes: hello@riseup.media.",
        ],
      },
    ],
  },
  creators: {
    short: "Creators",
    title: "Creators",
    tagline: "How to grow, earn and keep control of your channel.",
    sections: [
      {
        heading: "Earning tokens",
        body: [
          "Tokens are RiseUp's internal currency. Publishing a short earns 30 tokens and a long-form video earns 50, once per format per day — consistency pays, spam does not.",
          "Viewers spend tokens in the Shop, and those tokens land in the seller's balance immediately.",
        ],
      },
      {
        heading: "Getting distribution",
        body: [
          "New uploads are tested with your subscribers first. If they watch instead of bouncing, the video moves to viewers of your topic, then to the broad home feed. Retention drives every step.",
          "Shorts are judged differently: the platform measures whether people stayed past the first seconds and whether they looped, not whether they clicked.",
        ],
      },
      {
        heading: "Selling products",
        body: [
          "Studio → Shop lets you upload a digital product with a money price, a token price or both. Files are stored privately and released only to buyers.",
        ],
      },
    ],
  },
  advertise: {
    short: "Advertise",
    title: "Advertise on RiseUp",
    tagline: "Reach an audience that shows up every day.",
    sections: [
      {
        heading: "The audience",
        body: [
          "RiseUp viewers come to train, study, build businesses and hold streaks. Intent is high and sessions are habitual rather than accidental.",
        ],
      },
      {
        heading: "Formats",
        body: [
          "Sponsored placements inside topic feeds, creator partnerships brokered directly with the channel, and product placements in the Shop.",
          "We do not sell interruptive pre-roll on shorts. It breaks the experience and the numbers show it.",
        ],
      },
      {
        heading: "Get started",
        body: ["Email ads@riseup.media with your budget range, target topics and campaign window."],
      },
    ],
  },
  developers: {
    short: "Developers",
    title: "Developers",
    tagline: "Build on top of RiseUp.",
    sections: [
      {
        heading: "Public endpoints",
        body: [
          "RiseUp exposes read endpoints under /api/public/ for integrations, plus signed webhooks for purchase events. Every write path requires an authenticated session.",
        ],
      },
      {
        heading: "Media pipeline",
        body: [
          "Uploads are encoded client-side with ffmpeg compiled to WebAssembly, producing 360p, 720p and 1080p H.264 MP4s with the moov atom moved to the front so playback starts before the file finishes buffering.",
          "The player selects a rendition from connection type, save-data preference and viewport size, and viewers can override it manually.",
        ],
      },
      {
        heading: "Access",
        body: ["API keys are issued on request: developers@riseup.media."],
      },
    ],
  },
  terms: {
    short: "Terms",
    title: "Terms of service",
    tagline: "The rules for using RiseUp.",
    sections: [
      {
        heading: "Your account",
        body: [
          "You must be able to form a binding contract to use RiseUp. You are responsible for what happens under your account and for keeping your credentials safe.",
        ],
      },
      {
        heading: "Your content",
        body: [
          "You keep ownership of everything you upload and grant RiseUp a non-exclusive licence to host, encode and stream it. You confirm you have the rights to every element of what you publish, including music.",
        ],
      },
      {
        heading: "Tokens and purchases",
        body: [
          "Tokens have no cash value and cannot be withdrawn or exchanged outside RiseUp. Digital product sales are final once the file is delivered, unless the product is materially not as described.",
        ],
      },
      {
        heading: "Termination",
        body: [
          "We may suspend accounts that break these terms, infringe copyright repeatedly or endanger other users. You can delete your account at any time from Settings.",
        ],
      },
    ],
  },
  privacy: {
    short: "Privacy",
    title: "Privacy",
    tagline: "What we collect, why, and what we refuse to do with it.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Account details you give us, the content you upload, and interaction data: what you watched, liked, saved and followed. Playback and upload events are logged to keep the service working.",
        ],
      },
      {
        heading: "How it is used",
        body: [
          "Interaction data powers your recommendations and your streaks. It is not sold, and it is not shared with advertisers as individual profiles.",
        ],
      },
      {
        heading: "Your controls",
        body: [
          "Clear your watch history from the Library, unlike or unsave anything at any time, and delete your account with all associated content from Settings.",
        ],
      },
    ],
  },
  "policy-safety": {
    short: "Policy & Safety",
    title: "Policy & safety",
    tagline: "What is not allowed here, and how we enforce it.",
    sections: [
      {
        heading: "Not allowed",
        body: [
          "Harassment, hate speech and threats. Sexual content involving minors, in any form. Content encouraging self-harm, disordered eating or dangerous unsupervised challenges. Scams, fake earnings claims and unverified supplement or medical advice sold as fact.",
        ],
      },
      {
        heading: "Enforcement",
        body: [
          "Reports go to a human. Depending on severity we remove the content, restrict distribution, or terminate the channel. Serious harm results in immediate removal without a warning.",
        ],
      },
      {
        heading: "Appeals",
        body: ["Every enforcement action can be appealed once at safety@riseup.media."],
      },
    ],
  },
  "how-riseup-works": {
    short: "How RiseUp works",
    title: "How RiseUp works",
    tagline: "The recommendation system, explained without hand-waving.",
    sections: [
      {
        heading: "Two stages, not one algorithm",
        body: [
          "There is no single algorithm. First, candidate generation narrows every eligible video down to a shortlist using your watch history, likes, saves, subscriptions and how recent each video is.",
          "Second, ranking scores that shortlist. Long-form is scored on predicted engagement rate and expected watch time. Popularity alone does not win.",
        ],
      },
      {
        heading: "Shorts are scored differently",
        body: [
          "Swipes replace clicks, so shorts are ranked on whether viewers stayed instead of swiping away and whether they looped. Freshness decays roughly twice as fast as it does for long-form.",
        ],
      },
      {
        heading: "New uploads get a fair test",
        body: [
          "Every new video is shown to your subscribers first. Strong retention promotes it to viewers of the same topic, and then to the broad home feed. Weak retention slows distribution instead of hiding the video outright.",
        ],
      },
      {
        heading: "Encoding and playback",
        body: [
          "Your browser encodes each upload into 360p, 720p and 1080p H.264 with fast-start enabled, so viewers get instant playback and the right quality for their connection.",
        ],
      },
    ],
  },
  "test-new-features": {
    short: "Test new features",
    title: "Test new features",
    tagline: "What is currently in the lab.",
    sections: [
      {
        heading: "In testing now",
        body: [
          "Browser-side 1080p encoding for long-form uploads, manual quality switching in the player, and token-priced digital products with instant seller payout.",
        ],
      },
      {
        heading: "Coming next",
        body: [
          "Adaptive HLS streaming assembled from the existing renditions, scheduled uploads, and collaborative accountability rooms with shared streaks.",
        ],
      },
      {
        heading: "Join the testers",
        body: [
          "Email labs@riseup.media with your @handle. Testers get early access and their feedback goes straight to the people building it.",
        ],
      },
    ],
  },
};

export const INFO_ORDER = Object.keys(INFO_PAGES);
