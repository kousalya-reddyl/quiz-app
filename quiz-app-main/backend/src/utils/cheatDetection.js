const evaluateSuspicion = ({ violations = {}, percentage = 0, totalQuestions = 0, timeTaken = 0 }) => {
  const reasons = [];

  if ((violations.tabSwitches || 0) >= 3) {
    reasons.push('Repeated tab switches');
  }
  if ((violations.navigations || 0) > 0) {
    reasons.push('Navigation attempts detected');
  }
  if ((violations.blurs || 0) >= 5) {
    reasons.push('Frequent focus loss');
  }

  if (totalQuestions > 0) {
    const avgSeconds = timeTaken / totalQuestions;
    if (avgSeconds > 0 && avgSeconds < 4) {
      reasons.push('Unusually fast responses');
    }
  }

  if (percentage >= 98 && (violations.tabSwitches || 0) > 0) {
    reasons.push('High score with suspicious activity');
  }

  return {
    suspicious: reasons.length > 0,
    reasons
  };
};

module.exports = {
  evaluateSuspicion
};
