export const pluralizeWord = (qunatity: number, word: string, pluralSuffix: string = "s") =>
	`${qunatity} ${word}${qunatity !== 1 ? pluralSuffix : ""}`;
