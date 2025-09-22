export function computeEngagementPercent(likes: number, comments: number, shares: number, views: number) {
	if (views <= 0) return 0;
	return ((likes + comments + shares) / views) * 100;
}

export function estimateMediaValueEuros(totalViews: number, cpmEuros: number = 11) {
	return (totalViews / 1000) * cpmEuros;
}

export function computeRoi(estimatedMediaValue: number, budgetEuros: number) {
	if (budgetEuros <= 0) return 0;
	return (estimatedMediaValue - budgetEuros) / budgetEuros;
}

export function computeCpvEuros(budgetEuros: number, totalViews: number) {
	if (totalViews <= 0) return 0;
	return budgetEuros / totalViews;
}


