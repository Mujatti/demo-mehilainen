var demoMehilainenCare = {
  variant: 'care-navigator',
  labels: {
    heroTitle: 'Find the right care path before you book.',
    heroSubtitle: 'A guided healthcare assistant for comparing options, understanding specialties, and moving toward booking with confidence.',
    searchPlaceholder: 'Describe your need, symptom, or preferred specialist...',
    searchButtonText: 'Ask',
    followUpPlaceholder: 'Ask a follow-up about care options, specialties, or booking...',
    freshQuestionPlaceholder: 'Tell us what you need help with...',
    resetButtonText: 'New care journey',
    footerBrand: 'Mehiläinen',
    footerBrandUrl: 'https://www.mehilainen.fi/en',
    quickActionsTitle: 'Common care journeys',
    supportTitle: 'Booking support',
    supportBody: 'Visitors often want reassurance before booking. This variant puts guidance first, then routes them to the best next step.',
  },
  theme: {
    accentColor: '#006845',
    bgColor: '#F5F7F4',
    textColor: '#151515',
    fontFamily: '"Meliva Sans", Verdana, Geneva, sans-serif',
    logoUrl: '/mehilainen-logo.svg',
    borderRadius: '18px',
  },
  careQuickActions: [
    'I need help choosing the right specialist',
    'Compare options for asthma or allergy care',
    'Find the best service for a child or family member',
    'What can be handled digitally versus in person?',
    'Help me prepare before booking an appointment',
    'Show care options near Helsinki',
  ],
  careSupport: {
    phone: '010 414 0200',
    bookingUrl: 'https://www.mehilainen.fi/en',
    note: 'Example guidance panel using public site positioning and your uploaded style reference.',
  },
};

export default demoMehilainenCare;
