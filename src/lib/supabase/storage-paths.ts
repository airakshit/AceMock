abstract class FilePathsRetriever {
  static getDocumentFilePath: (
    userId: string,
    documentId: string,
    documentFileId: string,
  ) => string;

  static getDocumentFileSourceUrl: (
    userId: string,
    documentId: string,
    documentFileId: string,
    fileName: string,
  ) => string;

  static getDocumentFilePageSourceUrl: (
    userId: string,
    documentId: string,
    documentFileId: string,
    extention: string,
    pageNo: number,
  ) => string;

  static getDocumentFigures: (
    userId: string,
    documentId: string,
    documentFileId: string,
    figName: string,
    figOnPage: number,
    extention: string,
  ) => string;
}

export class PDFStoragePathsRetriever implements FilePathsRetriever {
  static getDocumentFilePath(
    userId: string,
    documentId: string,
    documentFileId: string,
  ): string {
    return `user/${userId}/documents/${documentId}/files/${documentFileId}`;
  }

  static getDocumentFileSourceUrl(
    userId: string,
    documentId: string,
    documentFileId: string,
    fileName: string,
  ) {
    return (
      this.getDocumentFilePath(userId, documentId, documentFileId) +
      `/${fileName}`
    );
  }
  static getDocumentFilePageSourceUrl(
    userId: string,
    documentId: string,
    documentFileId: string,
    extention: string,
    pageNo: number,
  ): string {
    return (
      this.getDocumentFilePath(userId, documentId, documentFileId) +
      `/pages/page-${pageNo}.${extention}`
    );
  }

  static getDocumentFileFigures(
    userId: string,
    documentId: string,
    documentFileId: string,
    figName: string,
    figOnPage: number,
    extention: string,
  ) {
    return (
      this.getDocumentFilePath(userId, documentId, documentFileId) +
      `/figures/p${figOnPage}/${figName}.${extention}`
    );
  }
}

export class ImageStoragePathsRetriever implements FilePathsRetriever {
  static getDocumentFilePath(
    userId: string,
    documentId: string,
    documentFileId: string,
  ): string {
    return `user/${userId}/documents/${documentId}/files/${documentFileId}`;
  }

  static getDocumentFileSourceUrl(
    userId: string,
    documentId: string,
    documentFileId: string,
    fileName: string,
  ) {
    return (
      this.getDocumentFilePath(userId, documentId, documentFileId) +
      `/${fileName}`
    );
  }

  static getDocumentFilePageSourceUrl(
    userId: string,
    documentId: string,
    documentFileId: string,
    extention: string,
  ): string {
    return (
      this.getDocumentFilePath(userId, documentId, documentFileId) +
      `/page.${extention}`
    );
  }

  static getDocumentFileFigures(
    userId: string,
    documentId: string,
    documentFileId: string,
    figName: string,
    extention: string,
  ) {
    return (
      this.getDocumentFilePath(userId, documentId, documentFileId) +
      `/figures/${figName}.${extention}`
    );
  }
}

export class AdminQuestionStoragePathRetriever {
  static getQuestionDiagramPath(
    userId: string,
    questionId: string,
    figName: string,
    extention: string | null = null,
  ): string {
    const parts: string[] = figName.split(".");
    if (extention === null && parts.length !== 2) {
      throw Error("Invalid input for question storage path.");
    }
    // figName is the fallback in other cases.
    const baseStr = `admin/${userId}/questions/${questionId}/diagrams`;

    if (parts.length === 1) return baseStr + `/${figName}.${extention}`;

    // Mismatch in extention in figName and extention variable is intentionally unchecked.
    // figName is the fallback.
    return baseStr + `/${figName}`;
  }

  static getQuestionSolutionDiagramPath(
    userId: string,
    questionId: string,
    figName: string,
    extention: string | null = null,
  ): string {
    const parts: string[] = figName.split(".");
    if (extention === null && parts.length !== 2) {
      throw Error("Invalid input for question storage path.");
    }
    const baseStr = `admin/${userId}/questions/${questionId}/solution_diagrams`;

    if (parts.length === 1) return baseStr + `/${figName}.${extention}`;

    return baseStr + `/${figName}`;
  }
}
