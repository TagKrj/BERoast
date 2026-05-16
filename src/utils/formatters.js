export const formatDateDisplay = (date) =>
  `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

export const toTitleCase = (value) =>
  value.charAt(0).toUpperCase() + value.slice(1);
