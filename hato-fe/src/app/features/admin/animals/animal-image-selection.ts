export interface AnimalImageSelectionResult {
  acceptedFiles: File[];
  rejectedCount: number;
}

export function selectImageFiles(files: File[]): AnimalImageSelectionResult {
  const acceptedFiles = files.filter((file) => file.type.startsWith('image/'));

  return {
    acceptedFiles,
    rejectedCount: files.length - acceptedFiles.length,
  };
}

export function imageSelectionMessage(result: AnimalImageSelectionResult): string | null {
  if (result.rejectedCount > 0 && result.acceptedFiles.length > 0) {
    return `Se ignoraron ${result.rejectedCount} archivo(s) porque no son imágenes.`;
  }

  if (result.rejectedCount > 0) {
    return 'Solo podés seleccionar archivos de imagen.';
  }

  if (result.acceptedFiles.length > 0) {
    return 'Revisá las miniaturas antes de guardar las imágenes.';
  }

  return null;
}
