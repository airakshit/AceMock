export const storagePaths = {
  _getDocumentFilePath(
    userId: string,
    documentId: string,
    documentFileId: string,
  ): string {
    return `user/${userId}/documents/${documentId}/files/${documentFileId}`;
  },

  getDocumentFileSourceUrl(
    userId: string,
    documentId: string,
    documentFileId: string,
    fileName: string,
  ): string {
    return (
      this._getDocumentFilePath(userId, documentId, documentFileId) +
      `/${fileName}`
    );
  },

  getDocumentFilePageSourceUrl(
    userId: string,
    documentId: string,
    documentFileId: string,
    fileName: string,
    extention: string,
    pageNo: number,
  ): string {
    return (
      this._getDocumentFilePath(userId, documentId, documentFileId) +
      `/pages/page-${pageNo}.${extention}`
    );
  },
};
