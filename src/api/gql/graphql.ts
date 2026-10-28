/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AuthMode =
  | 'BASIC_AUTH'
  | 'NONE'
  | 'SIMPLE_LOGIN'
  | 'UI_LOGIN';

export type BackupRestoreState =
  | 'FAILURE'
  | 'IDLE'
  | 'RESTORING_CATEGORIES'
  | 'RESTORING_MANGA'
  | 'RESTORING_META'
  | 'RESTORING_SETTINGS'
  | 'RESTORING_USER_SETTINGS'
  | 'SUCCESS';

export type BooleanFilterInput = {
  distinctFrom?: boolean | null | undefined;
  distinctFromAll?: Array<boolean> | null | undefined;
  distinctFromAny?: Array<boolean> | null | undefined;
  equalTo?: boolean | null | undefined;
  greaterThan?: boolean | null | undefined;
  greaterThanOrEqualTo?: boolean | null | undefined;
  in?: Array<boolean> | null | undefined;
  isNull?: boolean | null | undefined;
  lessThan?: boolean | null | undefined;
  lessThanOrEqualTo?: boolean | null | undefined;
  notDistinctFrom?: boolean | null | undefined;
  notEqualTo?: boolean | null | undefined;
  notEqualToAll?: Array<boolean> | null | undefined;
  notEqualToAny?: Array<boolean> | null | undefined;
  notIn?: Array<boolean> | null | undefined;
};

export type CbzMediaType =
  | 'COMPATIBLE'
  | 'LEGACY'
  | 'MODERN';

export type ChapterDownloadReorderInput = {
  chapterId: number;
  to: number;
};

export type ChapterFilterInput = {
  and?: Array<ChapterFilterInput> | null | undefined;
  chapterNumber?: DoubleFilterInput | null | undefined;
  fetchedAt?: LongFilterInput | null | undefined;
  id?: IntFilterInput | null | undefined;
  inLibrary?: BooleanFilterInput | null | undefined;
  isBookmarked?: BooleanFilterInput | null | undefined;
  isDownloaded?: BooleanFilterInput | null | undefined;
  isRead?: BooleanFilterInput | null | undefined;
  lastPageRead?: IntFilterInput | null | undefined;
  lastReadAt?: LongFilterInput | null | undefined;
  mangaId?: IntFilterInput | null | undefined;
  name?: StringFilterInput | null | undefined;
  not?: ChapterFilterInput | null | undefined;
  or?: Array<ChapterFilterInput> | null | undefined;
  pageCount?: IntFilterInput | null | undefined;
  realUrl?: StringFilterInput | null | undefined;
  scanlator?: StringFilterInput | null | undefined;
  sourceOrder?: IntFilterInput | null | undefined;
  uploadDate?: LongFilterInput | null | undefined;
  url?: StringFilterInput | null | undefined;
};

export type ClearCachedImagesInput = {
  cachedPages?: boolean | null | undefined;
  cachedThumbnails?: boolean | null | undefined;
  clientMutationId?: string | null | undefined;
  downloadedThumbnails?: boolean | null | undefined;
};

export type ConnectKoSyncAccountInput = {
  clientMutationId?: string | null | undefined;
  password: string;
  serverAddress: string;
  username: string;
};

export type ContentWarning =
  | 'MIXED'
  | 'NSFW'
  | 'SAFE';

export type DatabaseType =
  | 'H2'
  | 'POSTGRESQL';

export type DoubleFilterInput = {
  distinctFrom?: number | null | undefined;
  distinctFromAll?: Array<number> | null | undefined;
  distinctFromAny?: Array<number> | null | undefined;
  equalTo?: number | null | undefined;
  greaterThan?: number | null | undefined;
  greaterThanOrEqualTo?: number | null | undefined;
  in?: Array<number> | null | undefined;
  isNull?: boolean | null | undefined;
  lessThan?: number | null | undefined;
  lessThanOrEqualTo?: number | null | undefined;
  notDistinctFrom?: number | null | undefined;
  notEqualTo?: number | null | undefined;
  notEqualToAll?: Array<number> | null | undefined;
  notEqualToAny?: Array<number> | null | undefined;
  notIn?: Array<number> | null | undefined;
};

export type DownloadState =
  | 'DOWNLOADING'
  | 'ERROR'
  | 'FINISHED'
  | 'QUEUED';

export type DownloadUpdateType =
  | 'DEQUEUED'
  | 'ERROR'
  | 'FINISHED'
  | 'PAUSED'
  | 'POSITION'
  | 'PROGRESS'
  | 'QUEUED'
  | 'STOPPED';

export type DownloaderState =
  | 'STARTED'
  | 'STOPPED';

export type FetchSourceMangaType =
  | 'LATEST'
  | 'POPULAR'
  | 'SEARCH';

export type FilterChangeInput = {
  checkBoxState?: boolean | null | undefined;
  groupChange?: FilterChangeInput | null | undefined;
  position: number;
  selectState?: number | null | undefined;
  sortState?: SortSelectionInput | null | undefined;
  textState?: string | null | undefined;
  triState?: TriState | null | undefined;
};

export type IncludeOrExclude =
  | 'EXCLUDE'
  | 'INCLUDE'
  | 'UNSET';

export type IntFilterInput = {
  distinctFrom?: number | null | undefined;
  distinctFromAll?: Array<number> | null | undefined;
  distinctFromAny?: Array<number> | null | undefined;
  equalTo?: number | null | undefined;
  greaterThan?: number | null | undefined;
  greaterThanOrEqualTo?: number | null | undefined;
  in?: Array<number> | null | undefined;
  isNull?: boolean | null | undefined;
  lessThan?: number | null | undefined;
  lessThanOrEqualTo?: number | null | undefined;
  notDistinctFrom?: number | null | undefined;
  notEqualTo?: number | null | undefined;
  notEqualToAll?: Array<number> | null | undefined;
  notEqualToAny?: Array<number> | null | undefined;
  notIn?: Array<number> | null | undefined;
};

export type KoreaderSyncChecksumMethod =
  | 'BINARY'
  | 'FILENAME';

export type KoreaderSyncConflictStrategy =
  | 'DISABLED'
  | 'KEEP_LOCAL'
  | 'KEEP_REMOTE'
  | 'PROMPT';

export type KoreaderSyncLegacyStrategy =
  | 'DISABLED'
  | 'PROMPT'
  | 'RECEIVE'
  | 'SEND'
  | 'SILENT';

export type LoginInput = {
  clientMutationId?: string | null | undefined;
  password: string;
  username: string;
};

export type LongFilterInput = {
  distinctFrom?: string | null | undefined;
  distinctFromAll?: Array<string> | null | undefined;
  distinctFromAny?: Array<string> | null | undefined;
  equalTo?: string | null | undefined;
  greaterThan?: string | null | undefined;
  greaterThanOrEqualTo?: string | null | undefined;
  in?: Array<string> | null | undefined;
  isNull?: boolean | null | undefined;
  lessThan?: string | null | undefined;
  lessThanOrEqualTo?: string | null | undefined;
  notDistinctFrom?: string | null | undefined;
  notEqualTo?: string | null | undefined;
  notEqualToAll?: Array<string> | null | undefined;
  notEqualToAny?: Array<string> | null | undefined;
  notIn?: Array<string> | null | undefined;
};

export type MangaStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'LICENSED'
  | 'ONGOING'
  | 'ON_HIATUS'
  | 'PUBLISHING_FINISHED'
  | 'UNKNOWN';

export type MetaInput = {
  key: string;
  value: string;
};

export type PartialBackupFlagsInput = {
  includeCategories?: boolean | null | undefined;
  includeChapters?: boolean | null | undefined;
  includeClientData?: boolean | null | undefined;
  includeHistory?: boolean | null | undefined;
  includeManga?: boolean | null | undefined;
  includeServerSettings?: boolean | null | undefined;
  includeTracking?: boolean | null | undefined;
  includeUserSettings?: boolean | null | undefined;
};

export type PartialSettingsTypeInput = {
  authMode?: AuthMode | null | undefined;
  authPassword?: string | null | undefined;
  authUsername?: string | null | undefined;
  autoBackupIncludeCategories?: boolean | null | undefined;
  autoBackupIncludeChapters?: boolean | null | undefined;
  autoBackupIncludeClientData?: boolean | null | undefined;
  autoBackupIncludeHistory?: boolean | null | undefined;
  autoBackupIncludeManga?: boolean | null | undefined;
  autoBackupIncludeServerSettings?: boolean | null | undefined;
  autoBackupIncludeTracking?: boolean | null | undefined;
  autoBackupIncludeUserSettings?: boolean | null | undefined;
  /** @deprecated Replaced with autoDownloadNewChaptersLimit, replace with autoDownloadNewChaptersLimit */
  autoDownloadAheadLimit?: number | null | undefined;
  /** @deprecated Now per-user */
  autoDownloadIgnoreReUploads?: boolean | null | undefined;
  /** @deprecated Now per-user */
  autoDownloadNewChapters?: boolean | null | undefined;
  /** @deprecated Now per-user */
  autoDownloadNewChaptersLimit?: number | null | undefined;
  backupInterval?: number | null | undefined;
  backupPath?: string | null | undefined;
  backupTTL?: number | null | undefined;
  backupTime?: string | null | undefined;
  /** @deprecated Removed - prefer authMode, replace with authMode */
  basicAuthEnabled?: boolean | null | undefined;
  /** @deprecated Removed - prefer authPassword, replace with authPassword */
  basicAuthPassword?: string | null | undefined;
  /** @deprecated Removed - prefer authUsername, replace with authUsername */
  basicAuthUsername?: string | null | undefined;
  databasePassword?: string | null | undefined;
  databaseSchema?: string | null | undefined;
  databaseType?: DatabaseType | null | undefined;
  databaseUrl?: string | null | undefined;
  databaseUsername?: string | null | undefined;
  debugLogsEnabled?: boolean | null | undefined;
  downloadAsCbz?: boolean | null | undefined;
  downloadConversions?: Array<SettingsDownloadConversionTypeInput> | null | undefined;
  downloadsPath?: string | null | undefined;
  electronPath?: string | null | undefined;
  /** @deprecated Now per-user */
  excludeCompleted?: boolean | null | undefined;
  /** @deprecated Now per-user */
  excludeEntryWithUnreadChapters?: boolean | null | undefined;
  /** @deprecated Now per-user */
  excludeNotStarted?: boolean | null | undefined;
  /** @deprecated Now per-user */
  excludeUnreadChapters?: boolean | null | undefined;
  /** @deprecated Replaced with addExtensionStore and removeExtensionStore mutations, replace with extensionStores */
  extensionRepos?: Array<string> | null | undefined;
  flareSolverrAsResponseFallback?: boolean | null | undefined;
  flareSolverrEnabled?: boolean | null | undefined;
  flareSolverrSessionName?: string | null | undefined;
  flareSolverrSessionTtl?: number | null | undefined;
  flareSolverrTimeout?: number | null | undefined;
  flareSolverrUrl?: string | null | undefined;
  globalUpdateInterval?: number | null | undefined;
  /** @deprecated Removed - does not do anything */
  gqlDebugLogsEnabled?: boolean | null | undefined;
  hikariMaxPoolSize?: number | null | undefined;
  initialOpenInBrowserEnabled?: boolean | null | undefined;
  ip?: string | null | undefined;
  jwtAudience?: string | null | undefined;
  jwtRefreshExpiry?: string | null | undefined;
  jwtTokenExpiry?: string | null | undefined;
  kcefEnabled?: boolean | null | undefined;
  /** @deprecated Now per-user */
  koreaderSyncChecksumMethod?: KoreaderSyncChecksumMethod | null | undefined;
  /** @deprecated Moved to preference store. Is supposed to be random and gets auto generated, replace with MOVE TO PREFERENCES */
  koreaderSyncDeviceId?: string | null | undefined;
  /** @deprecated Now per-user */
  koreaderSyncPercentageTolerance?: number | null | undefined;
  /** @deprecated Moved to preference store. User is supposed to use a login/logout mutation, replace with MOVE TO PREFERENCES */
  koreaderSyncServerUrl?: string | null | undefined;
  /** @deprecated Replaced with koreaderSyncStrategyForward and koreaderSyncStrategyBackward, replace with koreaderSyncStrategyForward, koreaderSyncStrategyBackward */
  koreaderSyncStrategy?: KoreaderSyncLegacyStrategy | null | undefined;
  /** @deprecated Now per-user */
  koreaderSyncStrategyBackward?: KoreaderSyncConflictStrategy | null | undefined;
  /** @deprecated Now per-user */
  koreaderSyncStrategyForward?: KoreaderSyncConflictStrategy | null | undefined;
  /** @deprecated Moved to preference store. User is supposed to use a login/logout mutation, replace with MOVE TO PREFERENCES */
  koreaderSyncUserkey?: string | null | undefined;
  /** @deprecated Moved to preference store. User is supposed to use a login/logout mutation, replace with MOVE TO PREFERENCES */
  koreaderSyncUsername?: string | null | undefined;
  localSourcePath?: string | null | undefined;
  maxLogFileSize?: string | null | undefined;
  maxLogFiles?: number | null | undefined;
  maxLogFolderSize?: string | null | undefined;
  maxSourcesInParallel?: number | null | undefined;
  /** @deprecated Now per-user */
  opdsCbzMimetype?: CbzMediaType | null | undefined;
  /** @deprecated Now per-user */
  opdsChapterSortOrder?: SortOrder | null | undefined;
  /** @deprecated Now per-user */
  opdsEnablePageReadProgress?: boolean | null | undefined;
  /** @deprecated Now per-user */
  opdsItemsPerPage?: number | null | undefined;
  /** @deprecated Now per-user */
  opdsMarkAsReadOnDownload?: boolean | null | undefined;
  /** @deprecated Now per-user */
  opdsShowOnlyDownloadedChapters?: boolean | null | undefined;
  /** @deprecated Now per-user */
  opdsShowOnlyUnreadChapters?: boolean | null | undefined;
  /** @deprecated Now per-user */
  opdsSkipChapterMetadataFeed?: boolean | null | undefined;
  /** @deprecated Now per-user */
  opdsUseBinaryFileSizes?: boolean | null | undefined;
  port?: number | null | undefined;
  /** @deprecated Now per-user */
  serveConversions?: Array<SettingsDownloadConversionTypeInput> | null | undefined;
  socksProxyEnabled?: boolean | null | undefined;
  socksProxyHost?: string | null | undefined;
  socksProxyPassword?: string | null | undefined;
  socksProxyPort?: string | null | undefined;
  socksProxyUsername?: string | null | undefined;
  socksProxyVersion?: number | null | undefined;
  /** @deprecated Now per-user */
  syncDataCategories?: boolean | null | undefined;
  /** @deprecated Now per-user */
  syncDataChapters?: boolean | null | undefined;
  /** @deprecated Now per-user */
  syncDataHistory?: boolean | null | undefined;
  /** @deprecated Now per-user */
  syncDataManga?: boolean | null | undefined;
  /** @deprecated Now per-user */
  syncDataTracking?: boolean | null | undefined;
  /** @deprecated Now per-user */
  syncInterval?: string | null | undefined;
  /** @deprecated Now per-user */
  syncYomiApiKey?: string | null | undefined;
  /** @deprecated Now per-user */
  syncYomiEnabled?: boolean | null | undefined;
  /** @deprecated Now per-user */
  syncYomiHost?: string | null | undefined;
  systemTrayEnabled?: boolean | null | undefined;
  /** @deprecated Now per-user */
  updateMangas?: boolean | null | undefined;
  useHikariConnectionPool?: boolean | null | undefined;
  webUIChannel?: WebUiChannel | null | undefined;
  webUIFlavor?: WebUiFlavor | null | undefined;
  webUIInterface?: WebUiInterface | null | undefined;
  webUIUpdateCheckInterval?: number | null | undefined;
};

export type PartialUserSettingsTypeInput = {
  autoDownloadIgnoreReUploads?: boolean | null | undefined;
  autoDownloadNewChapters?: boolean | null | undefined;
  autoDownloadNewChaptersLimit?: number | null | undefined;
  excludeCompleted?: boolean | null | undefined;
  excludeEntryWithUnreadChapters?: boolean | null | undefined;
  excludeNotStarted?: boolean | null | undefined;
  excludeUnreadChapters?: boolean | null | undefined;
  koreaderSyncChecksumMethod?: KoreaderSyncChecksumMethod | null | undefined;
  koreaderSyncPercentageTolerance?: number | null | undefined;
  koreaderSyncStrategyBackward?: KoreaderSyncConflictStrategy | null | undefined;
  koreaderSyncStrategyForward?: KoreaderSyncConflictStrategy | null | undefined;
  opdsCbzMimetype?: CbzMediaType | null | undefined;
  opdsChapterSortOrder?: SortOrder | null | undefined;
  opdsEnablePageReadProgress?: boolean | null | undefined;
  opdsItemsPerPage?: number | null | undefined;
  opdsMarkAsReadOnDownload?: boolean | null | undefined;
  opdsShowOnlyDownloadedChapters?: boolean | null | undefined;
  opdsShowOnlyUnreadChapters?: boolean | null | undefined;
  opdsSkipChapterMetadataFeed?: boolean | null | undefined;
  opdsUseBinaryFileSizes?: boolean | null | undefined;
  serveConversions?: Array<SettingsDownloadConversionTypeInput> | null | undefined;
  syncDataCategories?: boolean | null | undefined;
  syncDataChapters?: boolean | null | undefined;
  syncDataHistory?: boolean | null | undefined;
  syncDataManga?: boolean | null | undefined;
  syncDataTracking?: boolean | null | undefined;
  syncInterval?: string | null | undefined;
  syncYomiApiKey?: string | null | undefined;
  syncYomiEnabled?: boolean | null | undefined;
  syncYomiHost?: string | null | undefined;
  updateMangas?: boolean | null | undefined;
};

export type RedeemRecoveryCodeInput = {
  clientMutationId?: string | null | undefined;
  code: string;
  newPassword: string;
};

export type RedeemRegistrationCodeInput = {
  clientMutationId?: string | null | undefined;
  code: string;
  password: string;
  username: string;
};

export type RefreshTokenInput = {
  clientMutationId?: string | null | undefined;
  refreshToken: string;
};

export type RegisterInput = {
  clientMutationId?: string | null | undefined;
  password: string;
  userPermissions?: Array<UserPermission> | null | undefined;
  username: string;
};

export type RestoreBackupInput = {
  backup: File;
  clientMutationId?: string | null | undefined;
  flags?: PartialBackupFlagsInput | null | undefined;
};

export type SetMangaMetasItemInput = {
  mangaIds: Array<number>;
  metas: Array<MetaInput>;
};

export type SetPasswordInput = {
  clientMutationId?: string | null | undefined;
  newPassword: string;
  oldPassword: string;
};

export type SettingsDownloadConversionHeaderTypeInput = {
  name: string;
  value: string;
};

export type SettingsDownloadConversionTypeInput = {
  callTimeout?: string | null | undefined;
  compressionLevel?: number | null | undefined;
  connectTimeout?: string | null | undefined;
  headers?: Array<SettingsDownloadConversionHeaderTypeInput> | null | undefined;
  mimeType: string;
  target: string;
};

export type SortOrder =
  | 'ASC'
  | 'ASC_NULLS_FIRST'
  | 'ASC_NULLS_LAST'
  | 'DESC'
  | 'DESC_NULLS_FIRST'
  | 'DESC_NULLS_LAST';

export type SortSelectionInput = {
  ascending: boolean;
  index: number;
};

export type SourcePreferenceChangeInput = {
  checkBoxState?: boolean | null | undefined;
  editTextState?: string | null | undefined;
  listState?: string | null | undefined;
  multiSelectState?: Array<string> | null | undefined;
  position: number;
  switchState?: boolean | null | undefined;
};

export type StartSyncResult =
  | 'SUCCESS'
  | 'SYNC_DISABLED'
  | 'SYNC_IN_PROGRESS';

export type StringFilterInput = {
  distinctFrom?: string | null | undefined;
  distinctFromAll?: Array<string> | null | undefined;
  distinctFromAny?: Array<string> | null | undefined;
  distinctFromInsensitive?: string | null | undefined;
  distinctFromInsensitiveAll?: Array<string> | null | undefined;
  distinctFromInsensitiveAny?: Array<string> | null | undefined;
  endsWith?: string | null | undefined;
  endsWithAll?: Array<string> | null | undefined;
  endsWithAny?: Array<string> | null | undefined;
  endsWithInsensitive?: string | null | undefined;
  endsWithInsensitiveAll?: Array<string> | null | undefined;
  endsWithInsensitiveAny?: Array<string> | null | undefined;
  equalTo?: string | null | undefined;
  greaterThan?: string | null | undefined;
  greaterThanInsensitive?: string | null | undefined;
  greaterThanOrEqualTo?: string | null | undefined;
  greaterThanOrEqualToInsensitive?: string | null | undefined;
  in?: Array<string> | null | undefined;
  inInsensitive?: Array<string> | null | undefined;
  includes?: string | null | undefined;
  includesAll?: Array<string> | null | undefined;
  includesAny?: Array<string> | null | undefined;
  includesInsensitive?: string | null | undefined;
  includesInsensitiveAll?: Array<string> | null | undefined;
  includesInsensitiveAny?: Array<string> | null | undefined;
  isNull?: boolean | null | undefined;
  lessThan?: string | null | undefined;
  lessThanInsensitive?: string | null | undefined;
  lessThanOrEqualTo?: string | null | undefined;
  lessThanOrEqualToInsensitive?: string | null | undefined;
  like?: string | null | undefined;
  likeAll?: Array<string> | null | undefined;
  likeAny?: Array<string> | null | undefined;
  likeInsensitive?: string | null | undefined;
  likeInsensitiveAll?: Array<string> | null | undefined;
  likeInsensitiveAny?: Array<string> | null | undefined;
  notDistinctFrom?: string | null | undefined;
  notDistinctFromInsensitive?: string | null | undefined;
  notEndsWith?: string | null | undefined;
  notEndsWithAll?: Array<string> | null | undefined;
  notEndsWithAny?: Array<string> | null | undefined;
  notEndsWithInsensitive?: string | null | undefined;
  notEndsWithInsensitiveAll?: Array<string> | null | undefined;
  notEndsWithInsensitiveAny?: Array<string> | null | undefined;
  notEqualTo?: string | null | undefined;
  notEqualToAll?: Array<string> | null | undefined;
  notEqualToAny?: Array<string> | null | undefined;
  notIn?: Array<string> | null | undefined;
  notInInsensitive?: Array<string> | null | undefined;
  notIncludes?: string | null | undefined;
  notIncludesAll?: Array<string> | null | undefined;
  notIncludesAny?: Array<string> | null | undefined;
  notIncludesInsensitive?: string | null | undefined;
  notIncludesInsensitiveAll?: Array<string> | null | undefined;
  notIncludesInsensitiveAny?: Array<string> | null | undefined;
  notLike?: string | null | undefined;
  notLikeAll?: Array<string> | null | undefined;
  notLikeAny?: Array<string> | null | undefined;
  notLikeInsensitive?: string | null | undefined;
  notLikeInsensitiveAll?: Array<string> | null | undefined;
  notLikeInsensitiveAny?: Array<string> | null | undefined;
  notStartsWith?: string | null | undefined;
  notStartsWithAll?: Array<string> | null | undefined;
  notStartsWithAny?: Array<string> | null | undefined;
  notStartsWithInsensitive?: string | null | undefined;
  notStartsWithInsensitiveAll?: Array<string> | null | undefined;
  notStartsWithInsensitiveAny?: Array<string> | null | undefined;
  startsWith?: string | null | undefined;
  startsWithAll?: Array<string> | null | undefined;
  startsWithAny?: Array<string> | null | undefined;
  startsWithInsensitive?: string | null | undefined;
  startsWithInsensitiveAll?: Array<string> | null | undefined;
  startsWithInsensitiveAny?: Array<string> | null | undefined;
};

export type SyncState =
  | 'CREATING_BACKUP'
  | 'DOWNLOADING'
  | 'ERROR'
  | 'MERGING'
  | 'RESTORING'
  | 'STARTED'
  | 'SUCCESS'
  | 'UPLOADING';

export type TriState =
  | 'EXCLUDE'
  | 'IGNORE'
  | 'INCLUDE';

export type UpdateCategoryPatchInput = {
  default?: boolean | null | undefined;
  includeInDownload?: IncludeOrExclude | null | undefined;
  includeInUpdate?: IncludeOrExclude | null | undefined;
  name?: string | null | undefined;
};

export type UpdateChapterPatchInput = {
  isBookmarked?: boolean | null | undefined;
  isRead?: boolean | null | undefined;
  lastPageRead?: number | null | undefined;
};

export type UpdateExtensionPatchInput = {
  install?: boolean | null | undefined;
  uninstall?: boolean | null | undefined;
  update?: boolean | null | undefined;
};

export type UpdateStrategy =
  | 'ALWAYS_UPDATE'
  | 'ONLY_FETCH_ONCE';

export type UpdateTrackInput = {
  clientMutationId?: string | null | undefined;
  /** This will only work if the tracker of the track record supports reading dates */
  finishDate?: string | null | undefined;
  lastChapterRead?: number | null | undefined;
  /** This will only work if the tracker of the track record supports private tracking */
  private?: boolean | null | undefined;
  recordId: number;
  scoreString?: string | null | undefined;
  /** This will only work if the tracker of the track record supports reading dates */
  startDate?: string | null | undefined;
  status?: number | null | undefined;
  /** @deprecated Replaced with "unbindTrack" mutation, replace with unbindTrack */
  unbind?: boolean | null | undefined;
};

export type UpdateUserInput = {
  clientMutationId?: string | null | undefined;
  permissions?: Array<UserPermission> | null | undefined;
  role?: UserRole | null | undefined;
  userId: number;
};

export type UserCodePurpose =
  | 'RECOVERY'
  | 'REGISTRATION';

export type UserPermission =
  | 'ACCESS_NSFW'
  | 'DOWNLOAD_CHAPTERS'
  | 'INSTALL_EXTENSIONS'
  | 'INSTALL_EXTERNAL_EXTENSIONS'
  | 'MANAGE_CACHE'
  | 'MANAGE_EXTENSION_STORES'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_SOURCE_PREFERENCES'
  | 'MANAGE_USERS'
  | 'UNINSTALL_EXTENSIONS';

export type UserRole =
  | 'ADMIN'
  | 'USER'
  | 'VISITOR';

export type ValidateBackupInput = {
  backup: File;
};

export type WebUiChannel =
  | 'BUNDLED'
  | 'PREVIEW'
  | 'STABLE';

export type WebUiFlavor =
  | 'CUSTOM'
  | 'VUI'
  | 'WEBUI';

export type WebUiInterface =
  | 'BROWSER'
  | 'ELECTRON';

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { login: { accessToken: string, refreshToken: string } };

export type CurrentUserQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentUserQuery = { user: { id: number, username: string, roles: Array<UserRole>, permissions: Array<UserPermission> } };

export type RedeemRegistrationCodeMutationVariables = Exact<{
  input: RedeemRegistrationCodeInput;
}>;


export type RedeemRegistrationCodeMutation = { redeemRegistrationCode: { accessToken: string, refreshToken: string } };

export type RedeemRecoveryCodeMutationVariables = Exact<{
  input: RedeemRecoveryCodeInput;
}>;


export type RedeemRecoveryCodeMutation = { redeemRecoveryCode: { accessToken: string, refreshToken: string } };

export type RefreshTokenMutationVariables = Exact<{
  input: RefreshTokenInput;
}>;


export type RefreshTokenMutation = { refreshToken: { accessToken: string } };

export type UpdateChaptersMutationVariables = Exact<{
  ids: Array<number> | number;
  patch: UpdateChapterPatchInput;
}>;


export type UpdateChaptersMutation = { updateChapters: { chapters: Array<{ id: number, isRead: boolean, isBookmarked: boolean, lastPageRead: number, manga: { id: number, unreadCount: number, bookmarkCount: number } }> } | null };

export type EnqueueDownloadsMutationVariables = Exact<{
  ids: Array<number> | number;
}>;


export type EnqueueDownloadsMutation = { enqueueChapterDownloads: { downloadStatus: { state: DownloaderState } } | null };

export type DeleteDownloadsMutationVariables = Exact<{
  ids: Array<number> | number;
}>;


export type DeleteDownloadsMutation = { deleteDownloadedChapters: { chapters: Array<{ id: number, isDownloaded: boolean, manga: { id: number, downloadCount: number } }> } | null };

export type DownloadItemFragment = { progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } };

export type DownloadsChangedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type DownloadsChangedSubscription = { downloadStatusChanged: { state: DownloaderState, omittedUpdates: boolean, initial: Array<{ progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } }> | null, updates: Array<{ type: DownloadUpdateType, download: { progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } } }> } };

export type DownloadsSnapshotQueryVariables = Exact<{ [key: string]: never; }>;


export type DownloadsSnapshotQuery = { downloadStatus: { state: DownloaderState, queue: Array<{ progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } }> } };

export type UpdaterChangedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type UpdaterChangedSubscription = { libraryUpdateStatusChanged: { omittedUpdates: boolean, jobsInfo: { isRunning: boolean, finishedJobs: number, totalJobs: number } } };

export type StartDownloaderMutationVariables = Exact<{ [key: string]: never; }>;


export type StartDownloaderMutation = { startDownloader: { downloadStatus: { state: DownloaderState } } | null };

export type StopDownloaderMutationVariables = Exact<{ [key: string]: never; }>;


export type StopDownloaderMutation = { stopDownloader: { downloadStatus: { state: DownloaderState } } | null };

export type AboutServerQueryVariables = Exact<{ [key: string]: never; }>;


export type AboutServerQuery = { aboutServer: { name: string, version: string } };

export type SourcesQueryVariables = Exact<{ [key: string]: never; }>;


export type SourcesQuery = { sources: { nodes: Array<{ id: string, name: string, displayName: string, lang: string, iconUrl: string, supportsLatest: boolean, contentWarning: ContentWarning, homeUrl: string | null }> } };

export type MangaInLibraryFragment = { id: number, inLibrary: boolean };

export type FetchSourceMangaMutationVariables = Exact<{
  source: string;
  type: FetchSourceMangaType;
  page: number;
  query?: string | null | undefined;
  filters?: Array<FilterChangeInput> | FilterChangeInput | null | undefined;
}>;


export type FetchSourceMangaMutation = { fetchSourceManga: { hasNextPage: boolean, mangas: Array<{ id: number, title: string, thumbnailUrl: string | null, author: string | null, inLibrary: boolean }> } | null };

type SourceFilterFields_CheckBoxFilter_Fragment = { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean };

type SourceFilterFields_GroupFilter_Fragment = { __typename: 'GroupFilter', name: string };

type SourceFilterFields_HeaderFilter_Fragment = { __typename: 'HeaderFilter', name: string };

type SourceFilterFields_SelectFilter_Fragment = { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number };

type SourceFilterFields_SeparatorFilter_Fragment = { __typename: 'SeparatorFilter', name: string };

type SourceFilterFields_SortFilter_Fragment = { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null };

type SourceFilterFields_TextFilter_Fragment = { __typename: 'TextFilter', name: string, textDefault: string };

type SourceFilterFields_TriStateFilter_Fragment = { __typename: 'TriStateFilter', name: string, triStateDefault: TriState };

export type SourceFilterFieldsFragment =
  | SourceFilterFields_CheckBoxFilter_Fragment
  | SourceFilterFields_GroupFilter_Fragment
  | SourceFilterFields_HeaderFilter_Fragment
  | SourceFilterFields_SelectFilter_Fragment
  | SourceFilterFields_SeparatorFilter_Fragment
  | SourceFilterFields_SortFilter_Fragment
  | SourceFilterFields_TextFilter_Fragment
  | SourceFilterFields_TriStateFilter_Fragment
;

type SourceFilterLevel1_CheckBoxFilter_Fragment = { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean };

type SourceFilterLevel1_GroupFilter_Fragment = { __typename: 'GroupFilter', name: string, filters: Array<
    | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
    | { __typename: 'GroupFilter', name: string }
    | { __typename: 'HeaderFilter', name: string }
    | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
    | { __typename: 'SeparatorFilter', name: string }
    | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
    | { __typename: 'TextFilter', name: string, textDefault: string }
    | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
  > };

type SourceFilterLevel1_HeaderFilter_Fragment = { __typename: 'HeaderFilter', name: string };

type SourceFilterLevel1_SelectFilter_Fragment = { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number };

type SourceFilterLevel1_SeparatorFilter_Fragment = { __typename: 'SeparatorFilter', name: string };

type SourceFilterLevel1_SortFilter_Fragment = { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null };

type SourceFilterLevel1_TextFilter_Fragment = { __typename: 'TextFilter', name: string, textDefault: string };

type SourceFilterLevel1_TriStateFilter_Fragment = { __typename: 'TriStateFilter', name: string, triStateDefault: TriState };

export type SourceFilterLevel1Fragment =
  | SourceFilterLevel1_CheckBoxFilter_Fragment
  | SourceFilterLevel1_GroupFilter_Fragment
  | SourceFilterLevel1_HeaderFilter_Fragment
  | SourceFilterLevel1_SelectFilter_Fragment
  | SourceFilterLevel1_SeparatorFilter_Fragment
  | SourceFilterLevel1_SortFilter_Fragment
  | SourceFilterLevel1_TextFilter_Fragment
  | SourceFilterLevel1_TriStateFilter_Fragment
;

type SourceFilterLevel2_CheckBoxFilter_Fragment = { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean };

type SourceFilterLevel2_GroupFilter_Fragment = { __typename: 'GroupFilter', name: string, filters: Array<
    | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
    | { __typename: 'GroupFilter', name: string, filters: Array<
        | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
        | { __typename: 'GroupFilter', name: string }
        | { __typename: 'HeaderFilter', name: string }
        | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
        | { __typename: 'SeparatorFilter', name: string }
        | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
        | { __typename: 'TextFilter', name: string, textDefault: string }
        | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
      > }
    | { __typename: 'HeaderFilter', name: string }
    | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
    | { __typename: 'SeparatorFilter', name: string }
    | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
    | { __typename: 'TextFilter', name: string, textDefault: string }
    | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
  > };

type SourceFilterLevel2_HeaderFilter_Fragment = { __typename: 'HeaderFilter', name: string };

type SourceFilterLevel2_SelectFilter_Fragment = { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number };

type SourceFilterLevel2_SeparatorFilter_Fragment = { __typename: 'SeparatorFilter', name: string };

type SourceFilterLevel2_SortFilter_Fragment = { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null };

type SourceFilterLevel2_TextFilter_Fragment = { __typename: 'TextFilter', name: string, textDefault: string };

type SourceFilterLevel2_TriStateFilter_Fragment = { __typename: 'TriStateFilter', name: string, triStateDefault: TriState };

export type SourceFilterLevel2Fragment =
  | SourceFilterLevel2_CheckBoxFilter_Fragment
  | SourceFilterLevel2_GroupFilter_Fragment
  | SourceFilterLevel2_HeaderFilter_Fragment
  | SourceFilterLevel2_SelectFilter_Fragment
  | SourceFilterLevel2_SeparatorFilter_Fragment
  | SourceFilterLevel2_SortFilter_Fragment
  | SourceFilterLevel2_TextFilter_Fragment
  | SourceFilterLevel2_TriStateFilter_Fragment
;

type SourceFilterLevel3_CheckBoxFilter_Fragment = { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean };

type SourceFilterLevel3_GroupFilter_Fragment = { __typename: 'GroupFilter', name: string, filters: Array<
    | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
    | { __typename: 'GroupFilter', name: string, filters: Array<
        | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
        | { __typename: 'GroupFilter', name: string, filters: Array<
            | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
            | { __typename: 'GroupFilter', name: string }
            | { __typename: 'HeaderFilter', name: string }
            | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
            | { __typename: 'SeparatorFilter', name: string }
            | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
            | { __typename: 'TextFilter', name: string, textDefault: string }
            | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
          > }
        | { __typename: 'HeaderFilter', name: string }
        | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
        | { __typename: 'SeparatorFilter', name: string }
        | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
        | { __typename: 'TextFilter', name: string, textDefault: string }
        | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
      > }
    | { __typename: 'HeaderFilter', name: string }
    | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
    | { __typename: 'SeparatorFilter', name: string }
    | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
    | { __typename: 'TextFilter', name: string, textDefault: string }
    | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
  > };

type SourceFilterLevel3_HeaderFilter_Fragment = { __typename: 'HeaderFilter', name: string };

type SourceFilterLevel3_SelectFilter_Fragment = { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number };

type SourceFilterLevel3_SeparatorFilter_Fragment = { __typename: 'SeparatorFilter', name: string };

type SourceFilterLevel3_SortFilter_Fragment = { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null };

type SourceFilterLevel3_TextFilter_Fragment = { __typename: 'TextFilter', name: string, textDefault: string };

type SourceFilterLevel3_TriStateFilter_Fragment = { __typename: 'TriStateFilter', name: string, triStateDefault: TriState };

export type SourceFilterLevel3Fragment =
  | SourceFilterLevel3_CheckBoxFilter_Fragment
  | SourceFilterLevel3_GroupFilter_Fragment
  | SourceFilterLevel3_HeaderFilter_Fragment
  | SourceFilterLevel3_SelectFilter_Fragment
  | SourceFilterLevel3_SeparatorFilter_Fragment
  | SourceFilterLevel3_SortFilter_Fragment
  | SourceFilterLevel3_TextFilter_Fragment
  | SourceFilterLevel3_TriStateFilter_Fragment
;

export type SourceFiltersQueryVariables = Exact<{
  id: string;
}>;


export type SourceFiltersQuery = { source: { id: string, filters: Array<
      | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
      | { __typename: 'GroupFilter', name: string, filters: Array<
          | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
          | { __typename: 'GroupFilter', name: string, filters: Array<
              | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
              | { __typename: 'GroupFilter', name: string, filters: Array<
                  | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
                  | { __typename: 'GroupFilter', name: string, filters: Array<
                      | { __typename: 'CheckBoxFilter', name: string, checkBoxDefault: boolean }
                      | { __typename: 'GroupFilter', name: string }
                      | { __typename: 'HeaderFilter', name: string }
                      | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
                      | { __typename: 'SeparatorFilter', name: string }
                      | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
                      | { __typename: 'TextFilter', name: string, textDefault: string }
                      | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
                    > }
                  | { __typename: 'HeaderFilter', name: string }
                  | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
                  | { __typename: 'SeparatorFilter', name: string }
                  | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
                  | { __typename: 'TextFilter', name: string, textDefault: string }
                  | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
                > }
              | { __typename: 'HeaderFilter', name: string }
              | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
              | { __typename: 'SeparatorFilter', name: string }
              | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
              | { __typename: 'TextFilter', name: string, textDefault: string }
              | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
            > }
          | { __typename: 'HeaderFilter', name: string }
          | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
          | { __typename: 'SeparatorFilter', name: string }
          | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
          | { __typename: 'TextFilter', name: string, textDefault: string }
          | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
        > }
      | { __typename: 'HeaderFilter', name: string }
      | { __typename: 'SelectFilter', name: string, values: Array<string>, selectDefault: number }
      | { __typename: 'SeparatorFilter', name: string }
      | { __typename: 'SortFilter', name: string, values: Array<string>, sortDefault: { index: number, ascending: boolean } | null }
      | { __typename: 'TextFilter', name: string, textDefault: string }
      | { __typename: 'TriStateFilter', name: string, triStateDefault: TriState }
    > } };

export type ExtensionFieldsFragment = { pkgName: string, name: string, lang: string, versionName: string, iconUrl: string, isInstalled: boolean, hasUpdate: boolean, isObsolete: boolean, contentWarning: ContentWarning, extensionStore: { indexUrl: string, name: string } | null };

export type ExtensionsQueryVariables = Exact<{ [key: string]: never; }>;


export type ExtensionsQuery = { extensions: { nodes: Array<{ pkgName: string, name: string, lang: string, versionName: string, iconUrl: string, isInstalled: boolean, hasUpdate: boolean, isObsolete: boolean, contentWarning: ContentWarning, extensionStore: { indexUrl: string, name: string } | null }> } };

export type FetchExtensionsMutationVariables = Exact<{ [key: string]: never; }>;


export type FetchExtensionsMutation = { fetchExtensions: { extensions: Array<{ pkgName: string, name: string, lang: string, versionName: string, iconUrl: string, isInstalled: boolean, hasUpdate: boolean, isObsolete: boolean, contentWarning: ContentWarning, extensionStore: { indexUrl: string, name: string } | null }> } | null };

export type ExtensionUpdateCountQueryVariables = Exact<{ [key: string]: never; }>;


export type ExtensionUpdateCountQuery = { extensions: { totalCount: number } };

export type UpdateExtensionMutationVariables = Exact<{
  id: string;
  patch: UpdateExtensionPatchInput;
}>;


export type UpdateExtensionMutation = { updateExtension: { extension: { pkgName: string, name: string, lang: string, versionName: string, iconUrl: string, isInstalled: boolean, hasUpdate: boolean, isObsolete: boolean, contentWarning: ContentWarning, extensionStore: { indexUrl: string, name: string } | null } | null } | null };

export type UpdateExtensionsMutationVariables = Exact<{
  ids: Array<string> | string;
}>;


export type UpdateExtensionsMutation = { updateExtensions: { extensions: Array<{ pkgName: string, name: string, lang: string, versionName: string, iconUrl: string, isInstalled: boolean, hasUpdate: boolean, isObsolete: boolean, contentWarning: ContentWarning, extensionStore: { indexUrl: string, name: string } | null }> } | null };

export type InstallExternalExtensionMutationVariables = Exact<{
  file: File;
}>;


export type InstallExternalExtensionMutation = { installExternalExtension: { extension: { pkgName: string, name: string, lang: string, versionName: string, iconUrl: string, isInstalled: boolean, hasUpdate: boolean, isObsolete: boolean, contentWarning: ContentWarning, extensionStore: { indexUrl: string, name: string } | null } } | null };

export type ConfigurableSourcesQueryVariables = Exact<{ [key: string]: never; }>;


export type ConfigurableSourcesQuery = { sources: { nodes: Array<{ id: string, displayName: string, lang: string, isConfigurable: boolean, extension: { pkgName: string } }> } };

type SourcePreferenceFields_CheckBoxPreference_Fragment = { __typename: 'CheckBoxPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, checkDefault: boolean, checkValue: boolean | null };

type SourcePreferenceFields_EditTextPreference_Fragment = { __typename: 'EditTextPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, dialogTitle: string | null, dialogMessage: string | null, textDefault: string | null, textValue: string | null };

type SourcePreferenceFields_ListPreference_Fragment = { __typename: 'ListPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, entries: Array<string>, entryValues: Array<string>, listDefault: string | null, listValue: string | null };

type SourcePreferenceFields_MultiSelectListPreference_Fragment = { __typename: 'MultiSelectListPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, dialogTitle: string | null, dialogMessage: string | null, entries: Array<string>, entryValues: Array<string>, multiDefault: Array<string> | null, multiValue: Array<string> | null };

type SourcePreferenceFields_SwitchPreference_Fragment = { __typename: 'SwitchPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, switchDefault: boolean, switchValue: boolean | null };

export type SourcePreferenceFieldsFragment =
  | SourcePreferenceFields_CheckBoxPreference_Fragment
  | SourcePreferenceFields_EditTextPreference_Fragment
  | SourcePreferenceFields_ListPreference_Fragment
  | SourcePreferenceFields_MultiSelectListPreference_Fragment
  | SourcePreferenceFields_SwitchPreference_Fragment
;

export type SourcePreferencesQueryVariables = Exact<{
  id: string;
}>;


export type SourcePreferencesQuery = { source: { id: string, displayName: string, preferences: Array<
      | { __typename: 'CheckBoxPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, checkDefault: boolean, checkValue: boolean | null }
      | { __typename: 'EditTextPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, dialogTitle: string | null, dialogMessage: string | null, textDefault: string | null, textValue: string | null }
      | { __typename: 'ListPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, entries: Array<string>, entryValues: Array<string>, listDefault: string | null, listValue: string | null }
      | { __typename: 'MultiSelectListPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, dialogTitle: string | null, dialogMessage: string | null, entries: Array<string>, entryValues: Array<string>, multiDefault: Array<string> | null, multiValue: Array<string> | null }
      | { __typename: 'SwitchPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, switchDefault: boolean, switchValue: boolean | null }
    > } };

export type UpdateSourcePreferenceMutationVariables = Exact<{
  source: string;
  change: SourcePreferenceChangeInput;
}>;


export type UpdateSourcePreferenceMutation = { updateSourcePreference: { source: { id: string, preferences: Array<
        | { __typename: 'CheckBoxPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, checkDefault: boolean, checkValue: boolean | null }
        | { __typename: 'EditTextPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, dialogTitle: string | null, dialogMessage: string | null, textDefault: string | null, textValue: string | null }
        | { __typename: 'ListPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, entries: Array<string>, entryValues: Array<string>, listDefault: string | null, listValue: string | null }
        | { __typename: 'MultiSelectListPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, dialogTitle: string | null, dialogMessage: string | null, entries: Array<string>, entryValues: Array<string>, multiDefault: Array<string> | null, multiValue: Array<string> | null }
        | { __typename: 'SwitchPreference', key: string | null, title: string | null, summary: string | null, visible: boolean, enabled: boolean, switchDefault: boolean, switchValue: boolean | null }
      > } } | null };

export type DevToolsLibraryTitlesQueryVariables = Exact<{ [key: string]: never; }>;


export type DevToolsLibraryTitlesQuery = { mangas: { nodes: Array<{ id: number, title: string }> } };

export type DevToolsPingQueryVariables = Exact<{ [key: string]: never; }>;


export type DevToolsPingQuery = { aboutServer: { name: string, version: string, buildType: string } };

export type DevToolsReadTargetsQueryVariables = Exact<{
  filter: ChapterFilterInput;
}>;


export type DevToolsReadTargetsQuery = { mangas: { nodes: Array<{ id: number, title: string, categories: { nodes: Array<{ id: number }> } }> }, chapters: { nodes: Array<{ id: number, mangaId: number }> } };

export type DequeueDownloadsMutationVariables = Exact<{
  ids: Array<number> | number;
}>;


export type DequeueDownloadsMutation = { dequeueChapterDownloads: { downloadStatus: { state: DownloaderState, queue: Array<{ progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } }> } } | null };

export type RequeueDownloadsMutationVariables = Exact<{
  ids: Array<number> | number;
}>;


export type RequeueDownloadsMutation = { enqueueChapterDownloads: { downloadStatus: { state: DownloaderState, queue: Array<{ progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } }> } } | null };

export type ReorderDownloadMutationVariables = Exact<{
  id: number;
  to: number;
}>;


export type ReorderDownloadMutation = { reorderChapterDownload: { downloadStatus: { state: DownloaderState, queue: Array<{ progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } }> } } | null };

export type ReorderDownloadsMutationVariables = Exact<{
  reorders: Array<ChapterDownloadReorderInput> | ChapterDownloadReorderInput;
}>;


export type ReorderDownloadsMutation = { reorderChapterDownloads: { downloadStatus: { state: DownloaderState, queue: Array<{ progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } }> } } | null };

export type ClearDownloadsMutationVariables = Exact<{ [key: string]: never; }>;


export type ClearDownloadsMutation = { clearDownloader: { downloadStatus: { state: DownloaderState, queue: Array<{ progress: number, state: DownloadState, position: number, tries: number, chapter: { id: number, name: string, chapterNumber: number, mangaId: number, pageCount: number }, manga: { id: number, title: string, thumbnailUrl: string | null } }> } } | null };

export type FavoriteMetasQueryVariables = Exact<{
  prefix: string;
}>;


export type FavoriteMetasQuery = { metas: { nodes: Array<{ key: string, value: string }> } };

export type SetFavoritesMutationVariables = Exact<{
  metas: Array<MetaInput> | MetaInput;
}>;


export type SetFavoritesMutation = { setGlobalMetas: { metas: Array<{ key: string, value: string }> } | null };

export type RemoveFavoritesMutationVariables = Exact<{
  keys: Array<string> | string;
}>;


export type RemoveFavoritesMutation = { deleteGlobalMetas: { metas: Array<{ key: string }> } | null };

export type GalleryCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type GalleryCountsQuery = { mangas: { nodes: Array<{ id: number, chapters: { totalCount: number } }> } };

export type GalleryReadChaptersQueryVariables = Exact<{
  first: number;
  offset: number;
}>;


export type GalleryReadChaptersQuery = { chapters: { nodes: Array<{ id: number, mangaId: number, isRead: boolean, pageCount: number, lastReadAt: string, meta: Array<{ key: string, value: string }> }>, pageInfo: { hasNextPage: boolean } } };

export type GalleryPeekQueryVariables = Exact<{
  id: number;
}>;


export type GalleryPeekQuery = { manga: { id: number, description: string | null, firstUnreadChapter: { id: number } | null } };

export type HistoryQueryVariables = Exact<{
  first: number;
  offset: number;
}>;


export type HistoryQuery = { chapters: { totalCount: number, pageInfo: { hasNextPage: boolean }, nodes: Array<{ id: number, name: string, chapterNumber: number, lastPageRead: number, pageCount: number, isRead: boolean, lastReadAt: string, meta: Array<{ key: string, value: string }>, manga: { id: number, title: string, thumbnailUrl: string | null, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } }> } };

export type HideHistoryMutationVariables = Exact<{
  ids: Array<number> | number;
  key: string;
  value: string;
}>;


export type HideHistoryMutation = { setChapterMetas: { metas: Array<{ chapterId: number, key: string, value: string }> } | null };

export type RecentReadsQueryVariables = Exact<{ [key: string]: never; }>;


export type RecentReadsQuery = { chapters: { nodes: Array<{ id: number, name: string, chapterNumber: number, sourceOrder: number, lastPageRead: number, pageCount: number, isRead: boolean, lastReadAt: string, meta: Array<{ key: string, value: string }>, manga: { id: number, title: string, thumbnailUrl: string | null, author: string | null, genre: Array<string>, description: string | null, inLibrary: boolean, unreadCount: number, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> }, firstUnreadChapter: { id: number, name: string, chapterNumber: number, lastPageRead: number, pageCount: number, lastReadAt: string } | null } }> } };

export type RecentUpdatesQueryVariables = Exact<{
  first: number;
  offset: number;
  filter: ChapterFilterInput;
}>;


export type RecentUpdatesQuery = { chapters: { totalCount: number, pageInfo: { hasNextPage: boolean }, nodes: Array<{ id: number, name: string, chapterNumber: number, sourceOrder: number, fetchedAt: string, uploadDate: string, isRead: boolean, isDownloaded: boolean, isBookmarked: boolean, lastPageRead: number, pageCount: number, mangaId: number, manga: { id: number, title: string, thumbnailUrl: string | null, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } }> } };

export type LaterMetasQueryVariables = Exact<{
  prefix: string;
}>;


export type LaterMetasQuery = { metas: { nodes: Array<{ key: string, value: string }> } };

export type LaterMangasQueryVariables = Exact<{
  ids: Array<number> | number;
}>;


export type LaterMangasQuery = { mangas: { nodes: Array<{ inLibrary: boolean, id: number, title: string, thumbnailUrl: string | null, author: string | null, artist: string | null, genre: Array<string>, status: MangaStatus, inLibraryAt: string, unreadCount: number, downloadCount: number, bookmarkCount: number, source: { id: string, displayName: string, contentWarning: ContentWarning, lang: string } | null, categories: { nodes: Array<{ id: number }> }, lastReadChapter: { id: number, lastReadAt: string, meta: Array<{ key: string, value: string }> } | null, latestReadChapter: { id: number } | null, latestFetchedChapter: { id: number, fetchedAt: string } | null, latestUploadedChapter: { id: number, uploadDate: string } | null, trackRecords: { nodes: Array<{ id: number, trackerId: number, displayScore: string }> } }> } };

export type SetLaterMutationVariables = Exact<{
  key: string;
  value: string;
}>;


export type SetLaterMutation = { setGlobalMeta: { meta: { key: string, value: string } } | null };

export type RemoveLaterMutationVariables = Exact<{
  keys: Array<string> | string;
}>;


export type RemoveLaterMutation = { deleteGlobalMetas: { metas: Array<{ key: string }> } | null };

export type LibraryMangaFieldsFragment = { id: number, title: string, thumbnailUrl: string | null, author: string | null, artist: string | null, genre: Array<string>, status: MangaStatus, inLibraryAt: string, unreadCount: number, downloadCount: number, bookmarkCount: number, source: { id: string, displayName: string, contentWarning: ContentWarning, lang: string } | null, categories: { nodes: Array<{ id: number }> }, lastReadChapter: { id: number, lastReadAt: string, meta: Array<{ key: string, value: string }> } | null, latestReadChapter: { id: number } | null, latestFetchedChapter: { id: number, fetchedAt: string } | null, latestUploadedChapter: { id: number, uploadDate: string } | null, trackRecords: { nodes: Array<{ id: number, trackerId: number, displayScore: string }> } };

export type LibraryMangasQueryVariables = Exact<{ [key: string]: never; }>;


export type LibraryMangasQuery = { mangas: { totalCount: number, nodes: Array<{ id: number, title: string, thumbnailUrl: string | null, author: string | null, artist: string | null, genre: Array<string>, status: MangaStatus, inLibraryAt: string, unreadCount: number, downloadCount: number, bookmarkCount: number, source: { id: string, displayName: string, contentWarning: ContentWarning, lang: string } | null, categories: { nodes: Array<{ id: number }> }, lastReadChapter: { id: number, lastReadAt: string, meta: Array<{ key: string, value: string }> } | null, latestReadChapter: { id: number } | null, latestFetchedChapter: { id: number, fetchedAt: string } | null, latestUploadedChapter: { id: number, uploadDate: string } | null, trackRecords: { nodes: Array<{ id: number, trackerId: number, displayScore: string }> } }> }, trackers: { nodes: Array<{ id: number, scores: Array<string> }> } };

export type CategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type CategoriesQuery = { categories: { nodes: Array<{ id: number, name: string, order: number, default: boolean, meta: Array<{ key: string, value: string }> }> } };

export type UpdateLibraryMutationVariables = Exact<{
  categories?: Array<number> | number | null | undefined;
}>;


export type UpdateLibraryMutation = { updateLibrary: { updateStatus: { jobsInfo: { isRunning: boolean, finishedJobs: number, totalJobs: number } } } | null };

export type UpdateStopMutationVariables = Exact<{ [key: string]: never; }>;


export type UpdateStopMutation = { updateStop: { clientMutationId: string | null } };

export type SetInLibraryMutationVariables = Exact<{
  ids: Array<number> | number;
  inLibrary: boolean;
}>;


export type SetInLibraryMutation = { updateMangas: { mangas: Array<{ id: number, inLibrary: boolean }> } | null };

export type SetMangasCategoriesMutationVariables = Exact<{
  ids: Array<number> | number;
  add?: Array<number> | number | null | undefined;
  remove?: Array<number> | number | null | undefined;
}>;


export type SetMangasCategoriesMutation = { updateMangasCategories: { mangas: Array<{ id: number, categories: { nodes: Array<{ id: number }> } }> } | null };

export type ChapterIdsQueryVariables = Exact<{
  filter: ChapterFilterInput;
}>;


export type ChapterIdsQuery = { chapters: { nodes: Array<{ id: number }> } };

export type MangaDetailQueryVariables = Exact<{
  id: number;
}>;


export type MangaDetailQuery = { manga: { id: number, title: string, thumbnailUrl: string | null, author: string | null, artist: string | null, description: string | null, genre: Array<string>, status: MangaStatus, updateStrategy: UpdateStrategy, realUrl: string | null, inLibrary: boolean, initialized: boolean, unreadCount: number, downloadCount: number, bookmarkCount: number, source: { id: string, displayName: string, contentWarning: ContentWarning, lang: string } | null, categories: { nodes: Array<{ id: number, default: boolean }> }, lastReadChapter: { id: number, lastReadAt: string } | null } };

export type MangaPeekFragment = { id: number, title: string, thumbnailUrl: string | null };

export type MangaChaptersQueryVariables = Exact<{
  mangaId: number;
}>;


export type MangaChaptersQuery = { chapters: { nodes: Array<{ id: number, name: string, chapterNumber: number, sourceOrder: number, scanlator: string | null, uploadDate: string, fetchedAt: string, isRead: boolean, isBookmarked: boolean, isDownloaded: boolean, lastPageRead: number, pageCount: number, lastReadAt: string, meta: Array<{ key: string, value: string }> }> } };

export type FetchMangaAndChaptersMutationVariables = Exact<{
  id: number;
}>;


export type FetchMangaAndChaptersMutation = { fetchMangaAndChapters: { manga: { id: number, title: string, thumbnailUrl: string | null, author: string | null, artist: string | null, description: string | null, genre: Array<string>, status: MangaStatus, initialized: boolean, unreadCount: number, downloadCount: number } } | null };

export type SetMangaInLibraryMutationVariables = Exact<{
  id: number;
  inLibrary: boolean;
}>;


export type SetMangaInLibraryMutation = { updateManga: { manga: { id: number, inLibrary: boolean } } | null };

export type SetMangaCategoriesMutationVariables = Exact<{
  id: number;
  add?: Array<number> | number | null | undefined;
  remove?: Array<number> | number | null | undefined;
}>;


export type SetMangaCategoriesMutation = { updateMangaCategories: { manga: { id: number, categories: { nodes: Array<{ id: number }> } } } | null };

export type MigrationTargetMutationVariables = Exact<{
  id: number;
}>;


export type MigrationTargetMutation = { fetchMangaAndChapters: { manga: { id: number, title: string, thumbnailUrl: string | null, author: string | null, inLibrary: boolean, source: { id: string, displayName: string } | null }, chapters: Array<{ id: number, chapterNumber: number, isRead: boolean, isBookmarked: boolean }> } | null };

export type MigrationMarksQueryVariables = Exact<{
  keys: Array<string> | string;
}>;


export type MigrationMarksQuery = { metas: { nodes: Array<{ key: string, value: string }> } };

export type CopyMigrationMarksMutationVariables = Exact<{
  metas: Array<MetaInput> | MetaInput;
}>;


export type CopyMigrationMarksMutation = { setGlobalMetas: { metas: Array<{ key: string, value: string }> } | null };

export type RemoveMigrationMarksMutationVariables = Exact<{
  keys: Array<string> | string;
}>;


export type RemoveMigrationMarksMutation = { deleteGlobalMetas: { metas: Array<{ key: string }> } | null };

export type NsfwMetasQueryVariables = Exact<{
  prefix: string;
}>;


export type NsfwMetasQuery = { metas: { nodes: Array<{ key: string, value: string }> } };

export type SetNsfwMetasMutationVariables = Exact<{
  metas: Array<MetaInput> | MetaInput;
}>;


export type SetNsfwMetasMutation = { setGlobalMetas: { metas: Array<{ key: string, value: string }> } | null };

export type RemoveNsfwMetasMutationVariables = Exact<{
  keys: Array<string> | string;
}>;


export type RemoveNsfwMetasMutation = { deleteGlobalMetas: { metas: Array<{ key: string }> } | null };

export type FetchChapterPagesMutationVariables = Exact<{
  chapterId: number;
}>;


export type FetchChapterPagesMutation = { fetchChapterPages: { pages: Array<string>, chapter: { id: number, pageCount: number } } | null };

export type SaveProgressMutationVariables = Exact<{
  id: number;
  lastPageRead: number;
  isRead?: boolean | null | undefined;
}>;


export type SaveProgressMutation = { updateChapter: { chapter: { id: number, lastPageRead: number, isRead: boolean, lastReadAt: string, manga: { id: number, unreadCount: number, lastReadChapter: { id: number, lastReadAt: string } | null } } } | null };

export type ReaderMangaMetaQueryVariables = Exact<{
  id: number;
}>;


export type ReaderMangaMetaQuery = { manga: { id: number, meta: Array<{ key: string, value: string }> } };

export type ReaderMetaOfQueryVariables = Exact<{
  ids: Array<number> | number;
}>;


export type ReaderMetaOfQuery = { mangas: { nodes: Array<{ id: number, meta: Array<{ key: string, value: string }> }> } };

export type ReaderMetaIndexQueryVariables = Exact<{ [key: string]: never; }>;


export type ReaderMetaIndexQuery = { mangas: { nodes: Array<{ id: number, meta: Array<{ key: string, value: string }> }> } };

export type SetReaderMetaMutationVariables = Exact<{
  items: Array<SetMangaMetasItemInput> | SetMangaMetasItemInput;
}>;


export type SetReaderMetaMutation = { setMangaMetas: { metas: Array<{ mangaId: number, key: string, value: string }> } | null };

export type ClearReaderMetaMutationVariables = Exact<{
  ids: Array<number> | number;
  prefixes: Array<string> | string;
}>;


export type ClearReaderMetaMutation = { deleteMangaMetas: { metas: Array<{ mangaId: number, key: string }> } | null };

export type SetPageBookmarksMutationVariables = Exact<{
  id: number;
  key: string;
  value: string;
}>;


export type SetPageBookmarksMutation = { setChapterMetas: { metas: Array<{ chapterId: number, key: string, value: string }> } | null };

export type CategoriesFullQueryVariables = Exact<{ [key: string]: never; }>;


export type CategoriesFullQuery = { categories: { nodes: Array<{ id: number, name: string, order: number, default: boolean, includeInUpdate: IncludeOrExclude, meta: Array<{ key: string, value: string }>, mangas: { totalCount: number } }> } };

export type CreateCategoryMutationVariables = Exact<{
  name: string;
}>;


export type CreateCategoryMutation = { createCategory: { category: { id: number } } | null };

export type UpdateCategoryMutationVariables = Exact<{
  id: number;
  patch: UpdateCategoryPatchInput;
}>;


export type UpdateCategoryMutation = { updateCategory: { category: { id: number, name: string, includeInUpdate: IncludeOrExclude } } | null };

export type DeleteCategoryMutationVariables = Exact<{
  id: number;
}>;


export type DeleteCategoryMutation = { deleteCategory: { category: { id: number } | null } | null };

export type MoveCategoryMutationVariables = Exact<{
  id: number;
  position: number;
}>;


export type MoveCategoryMutation = { updateCategoryOrder: { categories: Array<{ id: number, order: number }> } | null };

export type ServerSettingsFragment = { globalUpdateInterval: number, excludeUnreadChapters: boolean, excludeNotStarted: boolean, excludeCompleted: boolean, updateMangas: boolean, downloadsPath: string, downloadAsCbz: boolean, autoDownloadNewChapters: boolean, autoDownloadNewChaptersLimit: number, excludeEntryWithUnreadChapters: boolean, autoDownloadIgnoreReUploads: boolean, maxSourcesInParallel: number, localSourcePath: string, kcefEnabled: boolean, flareSolverrEnabled: boolean, flareSolverrUrl: string, flareSolverrTimeout: number, flareSolverrSessionName: string, flareSolverrSessionTtl: number, flareSolverrAsResponseFallback: boolean, backupPath: string, backupTime: string, backupInterval: number, backupTTL: number, autoBackupIncludeManga: boolean, autoBackupIncludeCategories: boolean, autoBackupIncludeChapters: boolean, autoBackupIncludeTracking: boolean, autoBackupIncludeHistory: boolean, autoBackupIncludeClientData: boolean, autoBackupIncludeServerSettings: boolean, syncYomiEnabled: boolean, syncYomiHost: string, syncInterval: string, syncDataManga: boolean, syncDataChapters: boolean, syncDataTracking: boolean, syncDataHistory: boolean, syncDataCategories: boolean, koreaderSyncChecksumMethod: KoreaderSyncChecksumMethod, koreaderSyncPercentageTolerance: number, koreaderSyncStrategyForward: KoreaderSyncConflictStrategy, koreaderSyncStrategyBackward: KoreaderSyncConflictStrategy, ip: string, port: number, authMode: AuthMode, authUsername: string, jwtTokenExpiry: string, jwtRefreshExpiry: string, socksProxyEnabled: boolean, socksProxyVersion: number, socksProxyHost: string, socksProxyPort: string, socksProxyUsername: string, webUIFlavor: WebUiFlavor, webUIChannel: WebUiChannel, webUIUpdateCheckInterval: number, initialOpenInBrowserEnabled: boolean, systemTrayEnabled: boolean, debugLogsEnabled: boolean, maxLogFiles: number, maxLogFileSize: string, maxLogFolderSize: string, databaseType: DatabaseType, databaseUrl: string, databaseUsername: string, useHikariConnectionPool: boolean, opdsUseBinaryFileSizes: boolean, opdsItemsPerPage: number, opdsEnablePageReadProgress: boolean, opdsMarkAsReadOnDownload: boolean, opdsShowOnlyUnreadChapters: boolean, opdsShowOnlyDownloadedChapters: boolean, opdsChapterSortOrder: SortOrder, opdsCbzMimetype: CbzMediaType, opdsSkipChapterMetadataFeed: boolean, downloadConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }>, serveConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }> };

export type UserSettingsFragment = { excludeUnreadChapters: boolean, excludeNotStarted: boolean, excludeCompleted: boolean, updateMangas: boolean, autoDownloadNewChapters: boolean, autoDownloadNewChaptersLimit: number, excludeEntryWithUnreadChapters: boolean, autoDownloadIgnoreReUploads: boolean, syncYomiEnabled: boolean, syncYomiHost: string, syncInterval: string, syncDataManga: boolean, syncDataChapters: boolean, syncDataTracking: boolean, syncDataHistory: boolean, syncDataCategories: boolean, koreaderSyncChecksumMethod: KoreaderSyncChecksumMethod, koreaderSyncPercentageTolerance: number, koreaderSyncStrategyForward: KoreaderSyncConflictStrategy, koreaderSyncStrategyBackward: KoreaderSyncConflictStrategy, opdsUseBinaryFileSizes: boolean, opdsItemsPerPage: number, opdsEnablePageReadProgress: boolean, opdsMarkAsReadOnDownload: boolean, opdsShowOnlyUnreadChapters: boolean, opdsShowOnlyDownloadedChapters: boolean, opdsChapterSortOrder: SortOrder, opdsCbzMimetype: CbzMediaType, opdsSkipChapterMetadataFeed: boolean, serveConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }> };

export type MultiUserSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type MultiUserSettingsQuery = { settings: { autoBackupIncludeUserSettings: boolean } };

export type UserSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type UserSettingsQuery = { userSettings: { excludeUnreadChapters: boolean, excludeNotStarted: boolean, excludeCompleted: boolean, updateMangas: boolean, autoDownloadNewChapters: boolean, autoDownloadNewChaptersLimit: number, excludeEntryWithUnreadChapters: boolean, autoDownloadIgnoreReUploads: boolean, syncYomiEnabled: boolean, syncYomiHost: string, syncInterval: string, syncDataManga: boolean, syncDataChapters: boolean, syncDataTracking: boolean, syncDataHistory: boolean, syncDataCategories: boolean, koreaderSyncChecksumMethod: KoreaderSyncChecksumMethod, koreaderSyncPercentageTolerance: number, koreaderSyncStrategyForward: KoreaderSyncConflictStrategy, koreaderSyncStrategyBackward: KoreaderSyncConflictStrategy, opdsUseBinaryFileSizes: boolean, opdsItemsPerPage: number, opdsEnablePageReadProgress: boolean, opdsMarkAsReadOnDownload: boolean, opdsShowOnlyUnreadChapters: boolean, opdsShowOnlyDownloadedChapters: boolean, opdsChapterSortOrder: SortOrder, opdsCbzMimetype: CbzMediaType, opdsSkipChapterMetadataFeed: boolean, serveConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }> } };

export type SetUserSettingsMutationVariables = Exact<{
  settings: PartialUserSettingsTypeInput;
}>;


export type SetUserSettingsMutation = { setUserSettings: { userSettings: { excludeUnreadChapters: boolean, excludeNotStarted: boolean, excludeCompleted: boolean, updateMangas: boolean, autoDownloadNewChapters: boolean, autoDownloadNewChaptersLimit: number, excludeEntryWithUnreadChapters: boolean, autoDownloadIgnoreReUploads: boolean, syncYomiEnabled: boolean, syncYomiHost: string, syncInterval: string, syncDataManga: boolean, syncDataChapters: boolean, syncDataTracking: boolean, syncDataHistory: boolean, syncDataCategories: boolean, koreaderSyncChecksumMethod: KoreaderSyncChecksumMethod, koreaderSyncPercentageTolerance: number, koreaderSyncStrategyForward: KoreaderSyncConflictStrategy, koreaderSyncStrategyBackward: KoreaderSyncConflictStrategy, opdsUseBinaryFileSizes: boolean, opdsItemsPerPage: number, opdsEnablePageReadProgress: boolean, opdsMarkAsReadOnDownload: boolean, opdsShowOnlyUnreadChapters: boolean, opdsShowOnlyDownloadedChapters: boolean, opdsChapterSortOrder: SortOrder, opdsCbzMimetype: CbzMediaType, opdsSkipChapterMetadataFeed: boolean, serveConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }> } } };

export type ServerSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type ServerSettingsQuery = { settings: { globalUpdateInterval: number, excludeUnreadChapters: boolean, excludeNotStarted: boolean, excludeCompleted: boolean, updateMangas: boolean, downloadsPath: string, downloadAsCbz: boolean, autoDownloadNewChapters: boolean, autoDownloadNewChaptersLimit: number, excludeEntryWithUnreadChapters: boolean, autoDownloadIgnoreReUploads: boolean, maxSourcesInParallel: number, localSourcePath: string, kcefEnabled: boolean, flareSolverrEnabled: boolean, flareSolverrUrl: string, flareSolverrTimeout: number, flareSolverrSessionName: string, flareSolverrSessionTtl: number, flareSolverrAsResponseFallback: boolean, backupPath: string, backupTime: string, backupInterval: number, backupTTL: number, autoBackupIncludeManga: boolean, autoBackupIncludeCategories: boolean, autoBackupIncludeChapters: boolean, autoBackupIncludeTracking: boolean, autoBackupIncludeHistory: boolean, autoBackupIncludeClientData: boolean, autoBackupIncludeServerSettings: boolean, syncYomiEnabled: boolean, syncYomiHost: string, syncInterval: string, syncDataManga: boolean, syncDataChapters: boolean, syncDataTracking: boolean, syncDataHistory: boolean, syncDataCategories: boolean, koreaderSyncChecksumMethod: KoreaderSyncChecksumMethod, koreaderSyncPercentageTolerance: number, koreaderSyncStrategyForward: KoreaderSyncConflictStrategy, koreaderSyncStrategyBackward: KoreaderSyncConflictStrategy, ip: string, port: number, authMode: AuthMode, authUsername: string, jwtTokenExpiry: string, jwtRefreshExpiry: string, socksProxyEnabled: boolean, socksProxyVersion: number, socksProxyHost: string, socksProxyPort: string, socksProxyUsername: string, webUIFlavor: WebUiFlavor, webUIChannel: WebUiChannel, webUIUpdateCheckInterval: number, initialOpenInBrowserEnabled: boolean, systemTrayEnabled: boolean, debugLogsEnabled: boolean, maxLogFiles: number, maxLogFileSize: string, maxLogFolderSize: string, databaseType: DatabaseType, databaseUrl: string, databaseUsername: string, useHikariConnectionPool: boolean, opdsUseBinaryFileSizes: boolean, opdsItemsPerPage: number, opdsEnablePageReadProgress: boolean, opdsMarkAsReadOnDownload: boolean, opdsShowOnlyUnreadChapters: boolean, opdsShowOnlyDownloadedChapters: boolean, opdsChapterSortOrder: SortOrder, opdsCbzMimetype: CbzMediaType, opdsSkipChapterMetadataFeed: boolean, downloadConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }>, serveConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }> } };

export type SetServerSettingsMutationVariables = Exact<{
  settings: PartialSettingsTypeInput;
}>;


export type SetServerSettingsMutation = { setSettings: { settings: { globalUpdateInterval: number, excludeUnreadChapters: boolean, excludeNotStarted: boolean, excludeCompleted: boolean, updateMangas: boolean, downloadsPath: string, downloadAsCbz: boolean, autoDownloadNewChapters: boolean, autoDownloadNewChaptersLimit: number, excludeEntryWithUnreadChapters: boolean, autoDownloadIgnoreReUploads: boolean, maxSourcesInParallel: number, localSourcePath: string, kcefEnabled: boolean, flareSolverrEnabled: boolean, flareSolverrUrl: string, flareSolverrTimeout: number, flareSolverrSessionName: string, flareSolverrSessionTtl: number, flareSolverrAsResponseFallback: boolean, backupPath: string, backupTime: string, backupInterval: number, backupTTL: number, autoBackupIncludeManga: boolean, autoBackupIncludeCategories: boolean, autoBackupIncludeChapters: boolean, autoBackupIncludeTracking: boolean, autoBackupIncludeHistory: boolean, autoBackupIncludeClientData: boolean, autoBackupIncludeServerSettings: boolean, syncYomiEnabled: boolean, syncYomiHost: string, syncInterval: string, syncDataManga: boolean, syncDataChapters: boolean, syncDataTracking: boolean, syncDataHistory: boolean, syncDataCategories: boolean, koreaderSyncChecksumMethod: KoreaderSyncChecksumMethod, koreaderSyncPercentageTolerance: number, koreaderSyncStrategyForward: KoreaderSyncConflictStrategy, koreaderSyncStrategyBackward: KoreaderSyncConflictStrategy, ip: string, port: number, authMode: AuthMode, authUsername: string, jwtTokenExpiry: string, jwtRefreshExpiry: string, socksProxyEnabled: boolean, socksProxyVersion: number, socksProxyHost: string, socksProxyPort: string, socksProxyUsername: string, webUIFlavor: WebUiFlavor, webUIChannel: WebUiChannel, webUIUpdateCheckInterval: number, initialOpenInBrowserEnabled: boolean, systemTrayEnabled: boolean, debugLogsEnabled: boolean, maxLogFiles: number, maxLogFileSize: string, maxLogFolderSize: string, databaseType: DatabaseType, databaseUrl: string, databaseUsername: string, useHikariConnectionPool: boolean, opdsUseBinaryFileSizes: boolean, opdsItemsPerPage: number, opdsEnablePageReadProgress: boolean, opdsMarkAsReadOnDownload: boolean, opdsShowOnlyUnreadChapters: boolean, opdsShowOnlyDownloadedChapters: boolean, opdsChapterSortOrder: SortOrder, opdsCbzMimetype: CbzMediaType, opdsSkipChapterMetadataFeed: boolean, downloadConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }>, serveConversions: Array<{ mimeType: string, target: string, compressionLevel: number | null }> } } };

export type SettingsAboutQueryVariables = Exact<{ [key: string]: never; }>;


export type SettingsAboutQuery = { aboutServer: { name: string, version: string, buildType: string, buildTime: string, github: string, discord: string, platformInfo: { arch: string, os: { name: string, version: string }, jvm: { javaVersion: string } } } };

export type CheckServerUpdatesQueryVariables = Exact<{ [key: string]: never; }>;


export type CheckServerUpdatesQuery = { checkForServerUpdates: Array<{ channel: string, tag: string, url: string }> };

export type SetPasswordMutationVariables = Exact<{
  input: SetPasswordInput;
}>;


export type SetPasswordMutation = { setPassword: { clientMutationId: string | null } };

export type CreateBackupMutationVariables = Exact<{ [key: string]: never; }>;


export type CreateBackupMutation = { createBackup: { url: string } };

export type ValidateBackupQueryVariables = Exact<{
  input: ValidateBackupInput;
}>;


export type ValidateBackupQuery = { validateBackup: { missingSources: Array<{ id: string, name: string }>, missingTrackers: Array<{ name: string }> } };

export type RestoreBackupMutationVariables = Exact<{
  input: RestoreBackupInput;
}>;


export type RestoreBackupMutation = { restoreBackup: { id: string } };

export type RestoreStatusQueryVariables = Exact<{
  id: string;
}>;


export type RestoreStatusQuery = { restoreStatus: { state: BackupRestoreState, mangaProgress: number, totalManga: number } | null };

export type ExtensionStoresQueryVariables = Exact<{ [key: string]: never; }>;


export type ExtensionStoresQuery = { extensionStores: { nodes: Array<{ indexUrl: string, name: string, badgeLabel: string, isLegacy: boolean }> } };

export type AddExtensionStoreMutationVariables = Exact<{
  url: string;
}>;


export type AddExtensionStoreMutation = { addExtensionStore: { extensionStore: { indexUrl: string, name: string, badgeLabel: string, isLegacy: boolean } } | null };

export type RemoveExtensionStoreMutationVariables = Exact<{
  url: string;
}>;


export type RemoveExtensionStoreMutation = { removeExtensionStore: { extensionStore: { indexUrl: string } | null } | null };

export type ClearCookiesAndCacheMutationVariables = Exact<{ [key: string]: never; }>;


export type ClearCookiesAndCacheMutation = { clearCookiesAndCache: { clientMutationId: string | null } };

export type ClearCachedImagesMutationVariables = Exact<{
  input: ClearCachedImagesInput;
}>;


export type ClearCachedImagesMutation = { clearCachedImages: { cachedPages: boolean | null, cachedThumbnails: boolean | null, downloadedThumbnails: boolean | null } };

export type LastSyncQueryVariables = Exact<{ [key: string]: never; }>;


export type LastSyncQuery = { lastSyncStatus: { state: SyncState, startDate: string, endDate: string | null, errorMessage: string | null } | null };

export type StartSyncMutationVariables = Exact<{ [key: string]: never; }>;


export type StartSyncMutation = { startSync: { result: StartSyncResult } };

export type KoSyncStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type KoSyncStatusQuery = { koSyncStatus: { isLoggedIn: boolean, serverAddress: string | null, username: string | null } };

export type ConnectKoSyncMutationVariables = Exact<{
  input: ConnectKoSyncAccountInput;
}>;


export type ConnectKoSyncMutation = { connectKoSyncAccount: { message: string | null, status: { isLoggedIn: boolean, serverAddress: string | null, username: string | null } } };

export type LogoutKoSyncMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutKoSyncMutation = { logoutKoSyncAccount: { status: { isLoggedIn: boolean, serverAddress: string | null, username: string | null } } };

export type UsersQueryVariables = Exact<{ [key: string]: never; }>;


export type UsersQuery = { users: { nodes: Array<{ id: number, username: string, roles: Array<UserRole>, permissions: Array<UserPermission> }> } };

export type UserCodesQueryVariables = Exact<{ [key: string]: never; }>;


export type UserCodesQuery = { userCodes: Array<{ id: number, purpose: UserCodePurpose, expiresAt: string, createdBy: { id: number, username: string }, user: { id: number, username: string } | null }> };

export type CreateRegistrationCodeMutationVariables = Exact<{ [key: string]: never; }>;


export type CreateRegistrationCodeMutation = { createRegistrationCode: { code: string, expiresAt: string } };

export type CreateRecoveryCodeMutationVariables = Exact<{
  userId: number;
}>;


export type CreateRecoveryCodeMutation = { createRecoveryCode: { code: string, expiresAt: string } };

export type RevokeUserCodeMutationVariables = Exact<{
  id: number;
}>;


export type RevokeUserCodeMutation = { revokeUserCode: { clientMutationId: string | null } };

export type UpdateUserMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserMutation = { updateUser: { user: { id: number, username: string, roles: Array<UserRole>, permissions: Array<UserPermission> } } };

export type RegisterUserMutationVariables = Exact<{
  input: RegisterInput;
}>;


export type RegisterUserMutation = { register: { clientMutationId: string | null } };

export type CreateShelfMutationVariables = Exact<{
  name: string;
}>;


export type CreateShelfMutation = { createCategory: { category: { id: number, name: string, order: number, default: boolean, meta: Array<{ key: string, value: string }> } } | null };

export type TagShelfMutationVariables = Exact<{
  id: number;
  key: string;
}>;


export type TagShelfMutation = { setCategoryMeta: { meta: { categoryId: number, key: string, value: string } } | null };

export type MangaCategoryIdsFragment = { categories: { nodes: Array<{ id: number }> } };

export type TrackerFieldsFragment = { id: number, name: string, icon: string, isLoggedIn: boolean, isTokenExpired: boolean, authUrl: string | null, supportsPrivateTracking: boolean, supportsReadingDates: boolean, supportsTrackDeletion: boolean, scores: Array<string>, statuses: Array<{ name: string, value: number }> };

export type TrackRecordFieldsFragment = { id: number, trackerId: number, mangaId: number, remoteId: string, remoteUrl: string, title: string, status: number, lastChapterRead: number, totalChapters: number, score: number, displayScore: string, startDate: string, finishDate: string, private: boolean };

export type TrackSearchFieldsFragment = { id: number, remoteId: string, title: string, coverUrl: string, summary: string, publishingStatus: string, publishingType: string, startDate: string, totalChapters: number, trackingUrl: string };

export type TrackersQueryVariables = Exact<{ [key: string]: never; }>;


export type TrackersQuery = { trackers: { nodes: Array<{ id: number, name: string, icon: string, isLoggedIn: boolean, isTokenExpired: boolean, authUrl: string | null, supportsPrivateTracking: boolean, supportsReadingDates: boolean, supportsTrackDeletion: boolean, scores: Array<string>, statuses: Array<{ name: string, value: number }> }> } };

export type MangaTracksQueryVariables = Exact<{
  id: number;
}>;


export type MangaTracksQuery = { manga: { id: number, trackRecords: { nodes: Array<{ id: number, trackerId: number, mangaId: number, remoteId: string, remoteUrl: string, title: string, status: number, lastChapterRead: number, totalChapters: number, score: number, displayScore: string, startDate: string, finishDate: string, private: boolean }> } } };

export type TrackedMangaIdsQueryVariables = Exact<{
  ids: Array<number> | number;
}>;


export type TrackedMangaIdsQuery = { trackRecords: { nodes: Array<{ id: number, mangaId: number }> } };

export type SearchTrackerQueryVariables = Exact<{
  trackerId: number;
  query: string;
}>;


export type SearchTrackerQuery = { searchTracker: { trackSearches: Array<{ id: number, remoteId: string, title: string, coverUrl: string, summary: string, publishingStatus: string, publishingType: string, startDate: string, totalChapters: number, trackingUrl: string }> } };

export type BindTrackMutationVariables = Exact<{
  mangaId: number;
  trackerId: number;
  remoteId: string;
  private?: boolean | null | undefined;
}>;


export type BindTrackMutation = { bindTrack: { trackRecord: { id: number, trackerId: number, mangaId: number, remoteId: string, remoteUrl: string, title: string, status: number, lastChapterRead: number, totalChapters: number, score: number, displayScore: string, startDate: string, finishDate: string, private: boolean } } };

export type UpdateTrackMutationVariables = Exact<{
  input: UpdateTrackInput;
}>;


export type UpdateTrackMutation = { updateTrack: { trackRecord: { id: number, trackerId: number, mangaId: number, remoteId: string, remoteUrl: string, title: string, status: number, lastChapterRead: number, totalChapters: number, score: number, displayScore: string, startDate: string, finishDate: string, private: boolean } | null } };

export type FetchTrackMutationVariables = Exact<{
  recordId: number;
}>;


export type FetchTrackMutation = { fetchTrack: { trackRecord: { id: number, trackerId: number, mangaId: number, remoteId: string, remoteUrl: string, title: string, status: number, lastChapterRead: number, totalChapters: number, score: number, displayScore: string, startDate: string, finishDate: string, private: boolean } } };

export type UnbindTrackMutationVariables = Exact<{
  recordId: number;
  deleteRemoteTrack?: boolean | null | undefined;
}>;


export type UnbindTrackMutation = { unbindTrack: { trackRecord: { id: number } | null } };

export type LoginTrackerOAuthMutationVariables = Exact<{
  trackerId: number;
  callbackUrl: string;
}>;


export type LoginTrackerOAuthMutation = { loginTrackerOAuth: { isLoggedIn: boolean, tracker: { id: number, name: string, icon: string, isLoggedIn: boolean, isTokenExpired: boolean, authUrl: string | null, supportsPrivateTracking: boolean, supportsReadingDates: boolean, supportsTrackDeletion: boolean, scores: Array<string>, statuses: Array<{ name: string, value: number }> } } };

export type LoginTrackerCredentialsMutationVariables = Exact<{
  trackerId: number;
  username: string;
  password: string;
}>;


export type LoginTrackerCredentialsMutation = { loginTrackerCredentials: { isLoggedIn: boolean, tracker: { id: number, name: string, icon: string, isLoggedIn: boolean, isTokenExpired: boolean, authUrl: string | null, supportsPrivateTracking: boolean, supportsReadingDates: boolean, supportsTrackDeletion: boolean, scores: Array<string>, statuses: Array<{ name: string, value: number }> } } };

export type LogoutTrackerMutationVariables = Exact<{
  trackerId: number;
}>;


export type LogoutTrackerMutation = { logoutTracker: { isLoggedIn: boolean, tracker: { id: number, name: string, icon: string, isLoggedIn: boolean, isTokenExpired: boolean, authUrl: string | null, supportsPrivateTracking: boolean, supportsReadingDates: boolean, supportsTrackDeletion: boolean, scores: Array<string>, statuses: Array<{ name: string, value: number }> } } };

export type LastUpdateQueryVariables = Exact<{ [key: string]: never; }>;


export type LastUpdateQuery = { lastUpdateTimestamp: { timestamp: string } };

export type UpdatesFeedChapterFragment = { id: number, name: string, chapterNumber: number, sourceOrder: number, fetchedAt: string, uploadDate: string, isRead: boolean, isDownloaded: boolean, isBookmarked: boolean, lastPageRead: number, pageCount: number, mangaId: number, manga: { id: number, title: string, thumbnailUrl: string | null, inLibraryAt: string, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } };

export type UpdatesFeedAllQueryVariables = Exact<{
  first: number;
  offset: number;
  filter: ChapterFilterInput;
}>;


export type UpdatesFeedAllQuery = { chapters: { totalCount: number, pageInfo: { hasNextPage: boolean }, nodes: Array<{ id: number, name: string, chapterNumber: number, sourceOrder: number, fetchedAt: string, uploadDate: string, isRead: boolean, isDownloaded: boolean, isBookmarked: boolean, lastPageRead: number, pageCount: number, mangaId: number, manga: { id: number, title: string, thumbnailUrl: string | null, inLibraryAt: string, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } }> } };

export type UpdatesFeedUnreadQueryVariables = Exact<{
  first: number;
  offset: number;
  filter: ChapterFilterInput;
}>;


export type UpdatesFeedUnreadQuery = { chapters: { totalCount: number, pageInfo: { hasNextPage: boolean }, nodes: Array<{ id: number, name: string, chapterNumber: number, sourceOrder: number, fetchedAt: string, uploadDate: string, isRead: boolean, isDownloaded: boolean, isBookmarked: boolean, lastPageRead: number, pageCount: number, mangaId: number, manga: { id: number, title: string, thumbnailUrl: string | null, inLibraryAt: string, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } }> } };

export type UpdatesFeedDownloadedQueryVariables = Exact<{
  first: number;
  offset: number;
  filter: ChapterFilterInput;
}>;


export type UpdatesFeedDownloadedQuery = { chapters: { totalCount: number, pageInfo: { hasNextPage: boolean }, nodes: Array<{ id: number, name: string, chapterNumber: number, sourceOrder: number, fetchedAt: string, uploadDate: string, isRead: boolean, isDownloaded: boolean, isBookmarked: boolean, lastPageRead: number, pageCount: number, mangaId: number, manga: { id: number, title: string, thumbnailUrl: string | null, inLibraryAt: string, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } }> } };

export type UpdatesFeedFavoriteQueryVariables = Exact<{
  first: number;
  offset: number;
  filter: ChapterFilterInput;
}>;


export type UpdatesFeedFavoriteQuery = { chapters: { totalCount: number, pageInfo: { hasNextPage: boolean }, nodes: Array<{ id: number, name: string, chapterNumber: number, sourceOrder: number, fetchedAt: string, uploadDate: string, isRead: boolean, isDownloaded: boolean, isBookmarked: boolean, lastPageRead: number, pageCount: number, mangaId: number, manga: { id: number, title: string, thumbnailUrl: string | null, inLibraryAt: string, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } }> } };

export type CalendarChaptersQueryVariables = Exact<{
  filter: ChapterFilterInput;
  first: number;
}>;


export type CalendarChaptersQuery = { chapters: { nodes: Array<{ id: number, mangaId: number, name: string, chapterNumber: number, uploadDate: string, fetchedAt: string, manga: { id: number, title: string, thumbnailUrl: string | null, status: MangaStatus, updateStrategy: UpdateStrategy, source: { id: string, displayName: string, contentWarning: ContentWarning } | null, categories: { nodes: Array<{ id: number }> } } }> } };

export type UpdateIntervalQueryVariables = Exact<{ [key: string]: never; }>;


export type UpdateIntervalQuery = { settings: { globalUpdateInterval: number } };

export const DownloadItemFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<DownloadItemFragment, unknown>;
export const MangaInLibraryFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MangaInLibrary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MangaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}}]}}]} as unknown as DocumentNode<MangaInLibraryFragment, unknown>;
export const SourceFilterFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TextFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"checkBoxDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TriStateFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"triStateDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SelectFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"selectDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SortFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"sortDefault"},"name":{"kind":"Name","value":"default"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"ascending"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"HeaderFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SeparatorFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<SourceFilterFieldsFragment, unknown>;
export const SourceFilterLevel1FragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel1"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TextFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"checkBoxDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TriStateFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"triStateDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SelectFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"selectDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SortFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"sortDefault"},"name":{"kind":"Name","value":"default"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"ascending"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"HeaderFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SeparatorFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<SourceFilterLevel1Fragment, unknown>;
export const SourceFilterLevel2FragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel2"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterLevel1"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TextFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"checkBoxDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TriStateFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"triStateDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SelectFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"selectDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SortFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"sortDefault"},"name":{"kind":"Name","value":"default"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"ascending"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"HeaderFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SeparatorFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel1"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}}]}}]}}]}}]} as unknown as DocumentNode<SourceFilterLevel2Fragment, unknown>;
export const SourceFilterLevel3FragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel3"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterLevel2"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TextFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"checkBoxDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TriStateFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"triStateDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SelectFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"selectDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SortFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"sortDefault"},"name":{"kind":"Name","value":"default"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"ascending"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"HeaderFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SeparatorFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel1"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel2"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterLevel1"}}]}}]}}]}}]} as unknown as DocumentNode<SourceFilterLevel3Fragment, unknown>;
export const ExtensionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExtensionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExtensionType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pkgName"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"versionName"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isInstalled"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpdate"}},{"kind":"Field","name":{"kind":"Name","value":"isObsolete"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ExtensionFieldsFragment, unknown>;
export const SourcePreferenceFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourcePreferenceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Preference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","alias":{"kind":"Name","value":"checkDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"checkValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SwitchPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","alias":{"kind":"Name","value":"switchDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"switchValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EditTextPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"dialogTitle"}},{"kind":"Field","name":{"kind":"Name","value":"dialogMessage"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"textValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ListPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"entries"}},{"kind":"Field","name":{"kind":"Name","value":"entryValues"}},{"kind":"Field","alias":{"kind":"Name","value":"listDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"listValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MultiSelectListPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"dialogTitle"}},{"kind":"Field","name":{"kind":"Name","value":"dialogMessage"}},{"kind":"Field","name":{"kind":"Name","value":"entries"}},{"kind":"Field","name":{"kind":"Name","value":"entryValues"}},{"kind":"Field","alias":{"kind":"Name","value":"multiDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"multiValue"},"name":{"kind":"Name","value":"currentValue"}}]}}]}}]} as unknown as DocumentNode<SourcePreferenceFieldsFragment, unknown>;
export const LibraryMangaFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LibraryMangaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MangaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}},{"kind":"Field","name":{"kind":"Name","value":"bookmarkCount"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestFetchedChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestUploadedChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackRecords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}}]}}]}}]}}]} as unknown as DocumentNode<LibraryMangaFieldsFragment, unknown>;
export const MangaPeekFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MangaPeek"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MangaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]} as unknown as DocumentNode<MangaPeekFragment, unknown>;
export const ServerSettingsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ServerSettings"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SettingsType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"globalUpdateInterval"}},{"kind":"Field","name":{"kind":"Name","value":"excludeUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"excludeNotStarted"}},{"kind":"Field","name":{"kind":"Name","value":"excludeCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"updateMangas"}},{"kind":"Field","name":{"kind":"Name","value":"downloadsPath"}},{"kind":"Field","name":{"kind":"Name","value":"downloadAsCbz"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChaptersLimit"}},{"kind":"Field","name":{"kind":"Name","value":"excludeEntryWithUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadIgnoreReUploads"}},{"kind":"Field","name":{"kind":"Name","value":"downloadConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"serveConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"maxSourcesInParallel"}},{"kind":"Field","name":{"kind":"Name","value":"localSourcePath"}},{"kind":"Field","name":{"kind":"Name","value":"kcefEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrUrl"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrTimeout"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrSessionName"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrSessionTtl"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrAsResponseFallback"}},{"kind":"Field","name":{"kind":"Name","value":"backupPath"}},{"kind":"Field","name":{"kind":"Name","value":"backupTime"}},{"kind":"Field","name":{"kind":"Name","value":"backupInterval"}},{"kind":"Field","name":{"kind":"Name","value":"backupTTL"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeManga"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeCategories"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeTracking"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeHistory"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeClientData"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeServerSettings"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiHost"}},{"kind":"Field","name":{"kind":"Name","value":"syncInterval"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataManga"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataChapters"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataTracking"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataHistory"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataCategories"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncChecksumMethod"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncPercentageTolerance"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyForward"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyBackward"}},{"kind":"Field","name":{"kind":"Name","value":"ip"}},{"kind":"Field","name":{"kind":"Name","value":"port"}},{"kind":"Field","name":{"kind":"Name","value":"authMode"}},{"kind":"Field","name":{"kind":"Name","value":"authUsername"}},{"kind":"Field","name":{"kind":"Name","value":"jwtTokenExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"jwtRefreshExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyVersion"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyHost"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyPort"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyUsername"}},{"kind":"Field","name":{"kind":"Name","value":"webUIFlavor"}},{"kind":"Field","name":{"kind":"Name","value":"webUIChannel"}},{"kind":"Field","name":{"kind":"Name","value":"webUIUpdateCheckInterval"}},{"kind":"Field","name":{"kind":"Name","value":"initialOpenInBrowserEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"systemTrayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"debugLogsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFiles"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFileSize"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFolderSize"}},{"kind":"Field","name":{"kind":"Name","value":"databaseType"}},{"kind":"Field","name":{"kind":"Name","value":"databaseUrl"}},{"kind":"Field","name":{"kind":"Name","value":"databaseUsername"}},{"kind":"Field","name":{"kind":"Name","value":"useHikariConnectionPool"}},{"kind":"Field","name":{"kind":"Name","value":"opdsUseBinaryFileSizes"}},{"kind":"Field","name":{"kind":"Name","value":"opdsItemsPerPage"}},{"kind":"Field","name":{"kind":"Name","value":"opdsEnablePageReadProgress"}},{"kind":"Field","name":{"kind":"Name","value":"opdsMarkAsReadOnDownload"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyDownloadedChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsChapterSortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"opdsCbzMimetype"}},{"kind":"Field","name":{"kind":"Name","value":"opdsSkipChapterMetadataFeed"}}]}}]} as unknown as DocumentNode<ServerSettingsFragment, unknown>;
export const UserSettingsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserSettings"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserSettingsType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"excludeUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"excludeNotStarted"}},{"kind":"Field","name":{"kind":"Name","value":"excludeCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"updateMangas"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChaptersLimit"}},{"kind":"Field","name":{"kind":"Name","value":"excludeEntryWithUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadIgnoreReUploads"}},{"kind":"Field","name":{"kind":"Name","value":"serveConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiHost"}},{"kind":"Field","name":{"kind":"Name","value":"syncInterval"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataManga"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataChapters"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataTracking"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataHistory"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataCategories"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncChecksumMethod"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncPercentageTolerance"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyForward"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyBackward"}},{"kind":"Field","name":{"kind":"Name","value":"opdsUseBinaryFileSizes"}},{"kind":"Field","name":{"kind":"Name","value":"opdsItemsPerPage"}},{"kind":"Field","name":{"kind":"Name","value":"opdsEnablePageReadProgress"}},{"kind":"Field","name":{"kind":"Name","value":"opdsMarkAsReadOnDownload"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyDownloadedChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsChapterSortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"opdsCbzMimetype"}},{"kind":"Field","name":{"kind":"Name","value":"opdsSkipChapterMetadataFeed"}}]}}]} as unknown as DocumentNode<UserSettingsFragment, unknown>;
export const MangaCategoryIdsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MangaCategoryIds"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MangaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<MangaCategoryIdsFragment, unknown>;
export const TrackerFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"isTokenExpired"}},{"kind":"Field","name":{"kind":"Name","value":"authUrl"}},{"kind":"Field","name":{"kind":"Name","value":"supportsPrivateTracking"}},{"kind":"Field","name":{"kind":"Name","value":"supportsReadingDates"}},{"kind":"Field","name":{"kind":"Name","value":"supportsTrackDeletion"}},{"kind":"Field","name":{"kind":"Name","value":"scores"}},{"kind":"Field","name":{"kind":"Name","value":"statuses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<TrackerFieldsFragment, unknown>;
export const TrackRecordFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackRecordType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"lastChapterRead"}},{"kind":"Field","name":{"kind":"Name","value":"totalChapters"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"finishDate"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<TrackRecordFieldsFragment, unknown>;
export const TrackSearchFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackSearchFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackSearchType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"remoteId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"coverUrl"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"publishingStatus"}},{"kind":"Field","name":{"kind":"Name","value":"publishingType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"totalChapters"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}}]}}]} as unknown as DocumentNode<TrackSearchFieldsFragment, unknown>;
export const UpdatesFeedChapterFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UpdatesFeedChapter"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdatesFeedChapterFragment, unknown>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const CurrentUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CurrentUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"roles"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"}}]}}]}}]} as unknown as DocumentNode<CurrentUserQuery, CurrentUserQueryVariables>;
export const RedeemRegistrationCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RedeemRegistrationCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RedeemRegistrationCodeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"redeemRegistrationCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}}]}}]}}]} as unknown as DocumentNode<RedeemRegistrationCodeMutation, RedeemRegistrationCodeMutationVariables>;
export const RedeemRecoveryCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RedeemRecoveryCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RedeemRecoveryCodeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"redeemRecoveryCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}},{"kind":"Field","name":{"kind":"Name","value":"refreshToken"}}]}}]}}]} as unknown as DocumentNode<RedeemRecoveryCodeMutation, RedeemRecoveryCodeMutationVariables>;
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RefreshTokenInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refreshToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accessToken"}}]}}]}}]} as unknown as DocumentNode<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const UpdateChaptersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateChapters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patch"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateChapterPatchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateChapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patch"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"bookmarkCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdateChaptersMutation, UpdateChaptersMutationVariables>;
export const EnqueueDownloadsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EnqueueDownloads"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enqueueChapterDownloads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}}]}}]}}]}}]} as unknown as DocumentNode<EnqueueDownloadsMutation, EnqueueDownloadsMutationVariables>;
export const DeleteDownloadsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteDownloads"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteDownloadedChapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<DeleteDownloadsMutation, DeleteDownloadsMutationVariables>;
export const DownloadsChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"DownloadsChanged"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatusChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"maxUpdates"},"value":{"kind":"IntValue","value":"50"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"omittedUpdates"}},{"kind":"Field","name":{"kind":"Name","value":"initial"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}},{"kind":"Field","name":{"kind":"Name","value":"updates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"download"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<DownloadsChangedSubscription, DownloadsChangedSubscriptionVariables>;
export const DownloadsSnapshotDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DownloadsSnapshot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"queue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<DownloadsSnapshotQuery, DownloadsSnapshotQueryVariables>;
export const UpdaterChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"UpdaterChanged"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"libraryUpdateStatusChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"maxUpdates"},"value":{"kind":"IntValue","value":"1"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"omittedUpdates"}},{"kind":"Field","name":{"kind":"Name","value":"jobsInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isRunning"}},{"kind":"Field","name":{"kind":"Name","value":"finishedJobs"}},{"kind":"Field","name":{"kind":"Name","value":"totalJobs"}}]}}]}}]}}]} as unknown as DocumentNode<UpdaterChangedSubscription, UpdaterChangedSubscriptionVariables>;
export const StartDownloaderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartDownloader"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startDownloader"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}}]}}]}}]}}]} as unknown as DocumentNode<StartDownloaderMutation, StartDownloaderMutationVariables>;
export const StopDownloaderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StopDownloader"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stopDownloader"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}}]}}]}}]}}]} as unknown as DocumentNode<StopDownloaderMutation, StopDownloaderMutationVariables>;
export const AboutServerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AboutServer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aboutServer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<AboutServerQuery, AboutServerQueryVariables>;
export const SourcesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"supportsLatest"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"homeUrl"}}]}}]}}]}}]} as unknown as DocumentNode<SourcesQuery, SourcesQueryVariables>;
export const FetchSourceMangaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FetchSourceManga"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"source"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LongString"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FetchSourceMangaType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FilterChangeInput"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fetchSourceManga"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"source"},"value":{"kind":"Variable","name":{"kind":"Name","value":"source"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"mangas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}}]}}]}}]}}]} as unknown as DocumentNode<FetchSourceMangaMutation, FetchSourceMangaMutationVariables>;
export const SourceFiltersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SourceFilters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LongString"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterLevel3"}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TextFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"checkBoxDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TriStateFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","alias":{"kind":"Name","value":"triStateDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SelectFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"selectDefault"},"name":{"kind":"Name","value":"default"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SortFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"values"}},{"kind":"Field","alias":{"kind":"Name","value":"sortDefault"},"name":{"kind":"Name","value":"default"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"ascending"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"HeaderFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SeparatorFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel1"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel2"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterLevel1"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourceFilterLevel3"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Filter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterFields"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GroupFilter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourceFilterLevel2"}}]}}]}}]}}]} as unknown as DocumentNode<SourceFiltersQuery, SourceFiltersQueryVariables>;
export const ExtensionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Extensions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extensions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExtensionFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExtensionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExtensionType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pkgName"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"versionName"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isInstalled"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpdate"}},{"kind":"Field","name":{"kind":"Name","value":"isObsolete"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ExtensionsQuery, ExtensionsQueryVariables>;
export const FetchExtensionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FetchExtensions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fetchExtensions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extensions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExtensionFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExtensionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExtensionType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pkgName"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"versionName"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isInstalled"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpdate"}},{"kind":"Field","name":{"kind":"Name","value":"isObsolete"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<FetchExtensionsMutation, FetchExtensionsMutationVariables>;
export const ExtensionUpdateCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExtensionUpdateCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extensions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"condition"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"hasUpdate"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode<ExtensionUpdateCountQuery, ExtensionUpdateCountQueryVariables>;
export const UpdateExtensionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateExtension"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patch"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateExtensionPatchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateExtension"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patch"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extension"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExtensionFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExtensionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExtensionType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pkgName"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"versionName"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isInstalled"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpdate"}},{"kind":"Field","name":{"kind":"Name","value":"isObsolete"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UpdateExtensionMutation, UpdateExtensionMutationVariables>;
export const UpdateExtensionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateExtensions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateExtensions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"update"},"value":{"kind":"BooleanValue","value":true}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extensions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExtensionFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExtensionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExtensionType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pkgName"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"versionName"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isInstalled"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpdate"}},{"kind":"Field","name":{"kind":"Name","value":"isObsolete"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UpdateExtensionsMutation, UpdateExtensionsMutationVariables>;
export const InstallExternalExtensionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InstallExternalExtension"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"file"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Upload"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"installExternalExtension"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"extensionFile"},"value":{"kind":"Variable","name":{"kind":"Name","value":"file"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extension"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExtensionFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExtensionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExtensionType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pkgName"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"versionName"}},{"kind":"Field","name":{"kind":"Name","value":"iconUrl"}},{"kind":"Field","name":{"kind":"Name","value":"isInstalled"}},{"kind":"Field","name":{"kind":"Name","value":"hasUpdate"}},{"kind":"Field","name":{"kind":"Name","value":"isObsolete"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<InstallExternalExtensionMutation, InstallExternalExtensionMutationVariables>;
export const ConfigurableSourcesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ConfigurableSources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}},{"kind":"Field","name":{"kind":"Name","value":"isConfigurable"}},{"kind":"Field","name":{"kind":"Name","value":"extension"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pkgName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ConfigurableSourcesQuery, ConfigurableSourcesQueryVariables>;
export const SourcePreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SourcePreferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LongString"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourcePreferenceFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourcePreferenceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Preference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","alias":{"kind":"Name","value":"checkDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"checkValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SwitchPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","alias":{"kind":"Name","value":"switchDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"switchValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EditTextPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"dialogTitle"}},{"kind":"Field","name":{"kind":"Name","value":"dialogMessage"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"textValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ListPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"entries"}},{"kind":"Field","name":{"kind":"Name","value":"entryValues"}},{"kind":"Field","alias":{"kind":"Name","value":"listDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"listValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MultiSelectListPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"dialogTitle"}},{"kind":"Field","name":{"kind":"Name","value":"dialogMessage"}},{"kind":"Field","name":{"kind":"Name","value":"entries"}},{"kind":"Field","name":{"kind":"Name","value":"entryValues"}},{"kind":"Field","alias":{"kind":"Name","value":"multiDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"multiValue"},"name":{"kind":"Name","value":"currentValue"}}]}}]}}]} as unknown as DocumentNode<SourcePreferencesQuery, SourcePreferencesQueryVariables>;
export const UpdateSourcePreferenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSourcePreference"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"source"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LongString"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"change"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SourcePreferenceChangeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSourcePreference"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"source"},"value":{"kind":"Variable","name":{"kind":"Name","value":"source"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"change"},"value":{"kind":"Variable","name":{"kind":"Name","value":"change"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"preferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SourcePreferenceFields"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SourcePreferenceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Preference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckBoxPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","alias":{"kind":"Name","value":"checkDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"checkValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SwitchPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","alias":{"kind":"Name","value":"switchDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"switchValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EditTextPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"dialogTitle"}},{"kind":"Field","name":{"kind":"Name","value":"dialogMessage"}},{"kind":"Field","alias":{"kind":"Name","value":"textDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"textValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ListPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"entries"}},{"kind":"Field","name":{"kind":"Name","value":"entryValues"}},{"kind":"Field","alias":{"kind":"Name","value":"listDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"listValue"},"name":{"kind":"Name","value":"currentValue"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MultiSelectListPreference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"dialogTitle"}},{"kind":"Field","name":{"kind":"Name","value":"dialogMessage"}},{"kind":"Field","name":{"kind":"Name","value":"entries"}},{"kind":"Field","name":{"kind":"Name","value":"entryValues"}},{"kind":"Field","alias":{"kind":"Name","value":"multiDefault"},"name":{"kind":"Name","value":"default"}},{"kind":"Field","alias":{"kind":"Name","value":"multiValue"},"name":{"kind":"Name","value":"currentValue"}}]}}]}}]} as unknown as DocumentNode<UpdateSourcePreferenceMutation, UpdateSourcePreferenceMutationVariables>;
export const DevToolsLibraryTitlesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DevToolsLibraryTitles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"condition"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"inLibrary"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]}}]} as unknown as DocumentNode<DevToolsLibraryTitlesQuery, DevToolsLibraryTitlesQueryVariables>;
export const DevToolsPingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DevToolsPing"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aboutServer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"buildType"}}]}}]}}]} as unknown as DocumentNode<DevToolsPingQuery, DevToolsPingQueryVariables>;
export const DevToolsReadTargetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DevToolsReadTargets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"condition"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"inLibrary"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}}]}}]}}]}}]} as unknown as DocumentNode<DevToolsReadTargetsQuery, DevToolsReadTargetsQueryVariables>;
export const DequeueDownloadsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DequeueDownloads"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dequeueChapterDownloads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"queue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<DequeueDownloadsMutation, DequeueDownloadsMutationVariables>;
export const RequeueDownloadsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequeueDownloads"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enqueueChapterDownloads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"queue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<RequeueDownloadsMutation, RequeueDownloadsMutationVariables>;
export const ReorderDownloadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReorderDownload"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderChapterDownload"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"chapterId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"queue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<ReorderDownloadMutation, ReorderDownloadMutationVariables>;
export const ReorderDownloadsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReorderDownloads"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reorders"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterDownloadReorderInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reorderChapterDownloads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"reorders"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reorders"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"queue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<ReorderDownloadsMutation, ReorderDownloadsMutationVariables>;
export const ClearDownloadsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ClearDownloads"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clearDownloader"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"downloadStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"queue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DownloadItem"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DownloadItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DownloadType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"tries"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}}]}}]}}]} as unknown as DocumentNode<ClearDownloadsMutation, ClearDownloadsMutationVariables>;
export const FavoriteMetasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FavoriteMetas"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWith"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<FavoriteMetasQuery, FavoriteMetasQueryVariables>;
export const SetFavoritesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetFavorites"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"metas"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MetaInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setGlobalMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"metas"},"value":{"kind":"Variable","name":{"kind":"Name","value":"metas"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<SetFavoritesMutation, SetFavoritesMutationVariables>;
export const RemoveFavoritesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveFavorites"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"keys"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteGlobalMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"keys"},"value":{"kind":"Variable","name":{"kind":"Name","value":"keys"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveFavoritesMutation, RemoveFavoritesMutationVariables>;
export const GalleryCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GalleryCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"condition"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"inLibrary"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GalleryCountsQuery, GalleryCountsQueryVariables>;
export const GalleryReadChaptersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GalleryReadChapters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"inLibrary"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"or"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isRead"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"equalTo"},"value":{"kind":"BooleanValue","value":true}}]}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lastReadAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"StringValue","value":"0","block":false}}]}}]}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"ID"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"ASC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}}]}}]}}]} as unknown as DocumentNode<GalleryReadChaptersQuery, GalleryReadChaptersQueryVariables>;
export const GalleryPeekDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GalleryPeek"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"firstUnreadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<GalleryPeekQuery, GalleryPeekQueryVariables>;
export const HistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"History"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lastReadAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"StringValue","value":"0","block":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"LAST_READ_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"connection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"StringValue","value":"ReadingHistory","block":false}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<HistoryQuery, HistoryQueryVariables>;
export const HideHistoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"HideHistory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"value"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setChapterMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"items"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"chapterIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"metas"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"value"},"value":{"kind":"Variable","name":{"kind":"Name","value":"value"}}}]}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapterId"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<HideHistoryMutation, HideHistoryMutationVariables>;
export const RecentReadsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RecentReads"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lastReadAt"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"greaterThan"},"value":{"kind":"StringValue","value":"0","block":false}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"LAST_READ_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"150"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"firstUnreadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<RecentReadsQuery, RecentReadsQueryVariables>;
export const RecentUpdatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RecentUpdates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"FETCHED_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"SOURCE_ORDER"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<RecentUpdatesQuery, RecentUpdatesQueryVariables>;
export const LaterMetasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LaterMetas"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWith"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<LaterMetasQuery, LaterMetasQueryVariables>;
export const LaterMangasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LaterMangas"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LibraryMangaFields"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LibraryMangaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MangaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}},{"kind":"Field","name":{"kind":"Name","value":"bookmarkCount"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestFetchedChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestUploadedChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackRecords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}}]}}]}}]}}]} as unknown as DocumentNode<LaterMangasQuery, LaterMangasQueryVariables>;
export const SetLaterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetLater"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"value"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setGlobalMeta"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"meta"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"value"},"value":{"kind":"Variable","name":{"kind":"Name","value":"value"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<SetLaterMutation, SetLaterMutationVariables>;
export const RemoveLaterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveLater"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"keys"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteGlobalMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"keys"},"value":{"kind":"Variable","name":{"kind":"Name","value":"keys"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveLaterMutation, RemoveLaterMutationVariables>;
export const LibraryMangasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LibraryMangas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"condition"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"inLibrary"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LibraryMangaFields"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"scores"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LibraryMangaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MangaType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}},{"kind":"Field","name":{"kind":"Name","value":"bookmarkCount"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestFetchedChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestUploadedChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}}]}},{"kind":"Field","name":{"kind":"Name","value":"trackRecords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}}]}}]}}]}}]} as unknown as DocumentNode<LibraryMangasQuery, LibraryMangasQueryVariables>;
export const CategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"categories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"ORDER"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"default"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CategoriesQuery, CategoriesQueryVariables>;
export const UpdateLibraryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateLibrary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"categories"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateLibrary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"categories"},"value":{"kind":"Variable","name":{"kind":"Name","value":"categories"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"jobsInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isRunning"}},{"kind":"Field","name":{"kind":"Name","value":"finishedJobs"}},{"kind":"Field","name":{"kind":"Name","value":"totalJobs"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdateLibraryMutation, UpdateLibraryMutationVariables>;
export const UpdateStopDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateStop"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateStop"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientMutationId"}}]}}]}}]} as unknown as DocumentNode<UpdateStopMutation, UpdateStopMutationVariables>;
export const SetInLibraryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetInLibrary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inLibrary"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMangas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"inLibrary"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inLibrary"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}}]}}]}}]}}]} as unknown as DocumentNode<SetInLibraryMutation, SetInLibraryMutationVariables>;
export const SetMangasCategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetMangasCategories"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"add"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"remove"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMangasCategories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"addToCategories"},"value":{"kind":"Variable","name":{"kind":"Name","value":"add"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"removeFromCategories"},"value":{"kind":"Variable","name":{"kind":"Name","value":"remove"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<SetMangasCategoriesMutation, SetMangasCategoriesMutationVariables>;
export const ChapterIdsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChapterIds"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<ChapterIdsQuery, ChapterIdsQueryVariables>;
export const MangaDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MangaDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"updateStrategy"}},{"kind":"Field","name":{"kind":"Name","value":"realUrl"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}},{"kind":"Field","name":{"kind":"Name","value":"initialized"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}},{"kind":"Field","name":{"kind":"Name","value":"bookmarkCount"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}},{"kind":"Field","name":{"kind":"Name","value":"lang"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"default"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]}}]} as unknown as DocumentNode<MangaDetailQuery, MangaDetailQueryVariables>;
export const MangaChaptersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MangaChapters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mangaId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"condition"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"mangaId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mangaId"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"SOURCE_ORDER"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"ASC"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"scanlator"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]} as unknown as DocumentNode<MangaChaptersQuery, MangaChaptersQueryVariables>;
export const FetchMangaAndChaptersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FetchMangaAndChapters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fetchMangaAndChapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"fetchManga"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"fetchChapters"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"artist"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"genre"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"initialized"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"downloadCount"}}]}}]}}]}}]} as unknown as DocumentNode<FetchMangaAndChaptersMutation, FetchMangaAndChaptersMutationVariables>;
export const SetMangaInLibraryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetMangaInLibrary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inLibrary"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateManga"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"inLibrary"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inLibrary"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}}]}}]}}]}}]} as unknown as DocumentNode<SetMangaInLibraryMutation, SetMangaInLibraryMutationVariables>;
export const SetMangaCategoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetMangaCategories"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"add"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"remove"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMangaCategories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"addToCategories"},"value":{"kind":"Variable","name":{"kind":"Name","value":"add"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"removeFromCategories"},"value":{"kind":"Variable","name":{"kind":"Name","value":"remove"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<SetMangaCategoriesMutation, SetMangaCategoriesMutationVariables>;
export const MigrationTargetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MigrationTarget"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fetchMangaAndChapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"fetchManga"},"value":{"kind":"BooleanValue","value":true}},{"kind":"ObjectField","name":{"kind":"Name","value":"fetchChapters"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"author"}},{"kind":"Field","name":{"kind":"Name","value":"inLibrary"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"chapters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}}]}}]}}]}}]} as unknown as DocumentNode<MigrationTargetMutation, MigrationTargetMutationVariables>;
export const MigrationMarksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MigrationMarks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"keys"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"keys"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<MigrationMarksQuery, MigrationMarksQueryVariables>;
export const CopyMigrationMarksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CopyMigrationMarks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"metas"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MetaInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setGlobalMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"metas"},"value":{"kind":"Variable","name":{"kind":"Name","value":"metas"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<CopyMigrationMarksMutation, CopyMigrationMarksMutationVariables>;
export const RemoveMigrationMarksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveMigrationMarks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"keys"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteGlobalMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"keys"},"value":{"kind":"Variable","name":{"kind":"Name","value":"keys"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveMigrationMarksMutation, RemoveMigrationMarksMutationVariables>;
export const NsfwMetasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NsfwMetas"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startsWith"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<NsfwMetasQuery, NsfwMetasQueryVariables>;
export const SetNsfwMetasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetNsfwMetas"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"metas"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MetaInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setGlobalMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"metas"},"value":{"kind":"Variable","name":{"kind":"Name","value":"metas"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<SetNsfwMetasMutation, SetNsfwMetasMutationVariables>;
export const RemoveNsfwMetasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveNsfwMetas"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"keys"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteGlobalMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"keys"},"value":{"kind":"Variable","name":{"kind":"Name","value":"keys"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveNsfwMetasMutation, RemoveNsfwMetasMutationVariables>;
export const FetchChapterPagesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FetchChapterPages"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chapterId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fetchChapterPages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"chapterId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chapterId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pages"}},{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}}]}}]}}]}}]} as unknown as DocumentNode<FetchChapterPagesMutation, FetchChapterPagesMutationVariables>;
export const SaveProgressDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveProgress"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lastPageRead"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isRead"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateChapter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lastPageRead"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lastPageRead"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"isRead"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isRead"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"unreadCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadChapter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lastReadAt"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<SaveProgressMutation, SaveProgressMutationVariables>;
export const ReaderMangaMetaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReaderMangaMeta"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<ReaderMangaMetaQuery, ReaderMangaMetaQueryVariables>;
export const ReaderMetaOfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReaderMetaOf"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ReaderMetaOfQuery, ReaderMetaOfQueryVariables>;
export const ReaderMetaIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReaderMetaIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ReaderMetaIndexQuery, ReaderMetaIndexQueryVariables>;
export const SetReaderMetaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetReaderMeta"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"items"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetMangaMetasItemInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setMangaMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"items"},"value":{"kind":"Variable","name":{"kind":"Name","value":"items"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<SetReaderMetaMutation, SetReaderMetaMutationVariables>;
export const ClearReaderMetaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ClearReaderMeta"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prefixes"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMangaMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"items"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"mangaIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"prefixes"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prefixes"}}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"key"}}]}}]}}]}}]} as unknown as DocumentNode<ClearReaderMetaMutation, ClearReaderMetaMutationVariables>;
export const SetPageBookmarksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetPageBookmarks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"value"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setChapterMetas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"items"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"chapterIds"},"value":{"kind":"ListValue","values":[{"kind":"Variable","name":{"kind":"Name","value":"id"}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"metas"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"value"},"value":{"kind":"Variable","name":{"kind":"Name","value":"value"}}}]}]}}]}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapterId"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<SetPageBookmarksMutation, SetPageBookmarksMutationVariables>;
export const CategoriesFullDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CategoriesFull"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"categories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"ORDER"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"default"}},{"kind":"Field","name":{"kind":"Name","value":"includeInUpdate"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mangas"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CategoriesFullQuery, CategoriesFullQueryVariables>;
export const CreateCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<CreateCategoryMutation, CreateCategoryMutationVariables>;
export const UpdateCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patch"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateCategoryPatchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"patch"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patch"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"includeInUpdate"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateCategoryMutation, UpdateCategoryMutationVariables>;
export const DeleteCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"categoryId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<DeleteCategoryMutation, DeleteCategoryMutationVariables>;
export const MoveCategoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MoveCategory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"position"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateCategoryOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"Variable","name":{"kind":"Name","value":"position"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}}]}}]} as unknown as DocumentNode<MoveCategoryMutation, MoveCategoryMutationVariables>;
export const MultiUserSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MultiUserSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeUserSettings"}}]}}]}}]} as unknown as DocumentNode<MultiUserSettingsQuery, MultiUserSettingsQueryVariables>;
export const UserSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserSettings"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserSettings"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserSettingsType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"excludeUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"excludeNotStarted"}},{"kind":"Field","name":{"kind":"Name","value":"excludeCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"updateMangas"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChaptersLimit"}},{"kind":"Field","name":{"kind":"Name","value":"excludeEntryWithUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadIgnoreReUploads"}},{"kind":"Field","name":{"kind":"Name","value":"serveConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiHost"}},{"kind":"Field","name":{"kind":"Name","value":"syncInterval"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataManga"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataChapters"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataTracking"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataHistory"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataCategories"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncChecksumMethod"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncPercentageTolerance"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyForward"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyBackward"}},{"kind":"Field","name":{"kind":"Name","value":"opdsUseBinaryFileSizes"}},{"kind":"Field","name":{"kind":"Name","value":"opdsItemsPerPage"}},{"kind":"Field","name":{"kind":"Name","value":"opdsEnablePageReadProgress"}},{"kind":"Field","name":{"kind":"Name","value":"opdsMarkAsReadOnDownload"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyDownloadedChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsChapterSortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"opdsCbzMimetype"}},{"kind":"Field","name":{"kind":"Name","value":"opdsSkipChapterMetadataFeed"}}]}}]} as unknown as DocumentNode<UserSettingsQuery, UserSettingsQueryVariables>;
export const SetUserSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetUserSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"settings"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PartialUserSettingsTypeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setUserSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userSettings"},"value":{"kind":"Variable","name":{"kind":"Name","value":"settings"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserSettings"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserSettings"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserSettingsType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"excludeUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"excludeNotStarted"}},{"kind":"Field","name":{"kind":"Name","value":"excludeCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"updateMangas"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChaptersLimit"}},{"kind":"Field","name":{"kind":"Name","value":"excludeEntryWithUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadIgnoreReUploads"}},{"kind":"Field","name":{"kind":"Name","value":"serveConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiHost"}},{"kind":"Field","name":{"kind":"Name","value":"syncInterval"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataManga"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataChapters"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataTracking"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataHistory"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataCategories"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncChecksumMethod"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncPercentageTolerance"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyForward"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyBackward"}},{"kind":"Field","name":{"kind":"Name","value":"opdsUseBinaryFileSizes"}},{"kind":"Field","name":{"kind":"Name","value":"opdsItemsPerPage"}},{"kind":"Field","name":{"kind":"Name","value":"opdsEnablePageReadProgress"}},{"kind":"Field","name":{"kind":"Name","value":"opdsMarkAsReadOnDownload"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyDownloadedChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsChapterSortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"opdsCbzMimetype"}},{"kind":"Field","name":{"kind":"Name","value":"opdsSkipChapterMetadataFeed"}}]}}]} as unknown as DocumentNode<SetUserSettingsMutation, SetUserSettingsMutationVariables>;
export const ServerSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ServerSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ServerSettings"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ServerSettings"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SettingsType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"globalUpdateInterval"}},{"kind":"Field","name":{"kind":"Name","value":"excludeUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"excludeNotStarted"}},{"kind":"Field","name":{"kind":"Name","value":"excludeCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"updateMangas"}},{"kind":"Field","name":{"kind":"Name","value":"downloadsPath"}},{"kind":"Field","name":{"kind":"Name","value":"downloadAsCbz"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChaptersLimit"}},{"kind":"Field","name":{"kind":"Name","value":"excludeEntryWithUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadIgnoreReUploads"}},{"kind":"Field","name":{"kind":"Name","value":"downloadConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"serveConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"maxSourcesInParallel"}},{"kind":"Field","name":{"kind":"Name","value":"localSourcePath"}},{"kind":"Field","name":{"kind":"Name","value":"kcefEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrUrl"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrTimeout"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrSessionName"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrSessionTtl"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrAsResponseFallback"}},{"kind":"Field","name":{"kind":"Name","value":"backupPath"}},{"kind":"Field","name":{"kind":"Name","value":"backupTime"}},{"kind":"Field","name":{"kind":"Name","value":"backupInterval"}},{"kind":"Field","name":{"kind":"Name","value":"backupTTL"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeManga"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeCategories"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeTracking"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeHistory"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeClientData"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeServerSettings"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiHost"}},{"kind":"Field","name":{"kind":"Name","value":"syncInterval"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataManga"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataChapters"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataTracking"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataHistory"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataCategories"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncChecksumMethod"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncPercentageTolerance"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyForward"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyBackward"}},{"kind":"Field","name":{"kind":"Name","value":"ip"}},{"kind":"Field","name":{"kind":"Name","value":"port"}},{"kind":"Field","name":{"kind":"Name","value":"authMode"}},{"kind":"Field","name":{"kind":"Name","value":"authUsername"}},{"kind":"Field","name":{"kind":"Name","value":"jwtTokenExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"jwtRefreshExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyVersion"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyHost"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyPort"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyUsername"}},{"kind":"Field","name":{"kind":"Name","value":"webUIFlavor"}},{"kind":"Field","name":{"kind":"Name","value":"webUIChannel"}},{"kind":"Field","name":{"kind":"Name","value":"webUIUpdateCheckInterval"}},{"kind":"Field","name":{"kind":"Name","value":"initialOpenInBrowserEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"systemTrayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"debugLogsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFiles"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFileSize"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFolderSize"}},{"kind":"Field","name":{"kind":"Name","value":"databaseType"}},{"kind":"Field","name":{"kind":"Name","value":"databaseUrl"}},{"kind":"Field","name":{"kind":"Name","value":"databaseUsername"}},{"kind":"Field","name":{"kind":"Name","value":"useHikariConnectionPool"}},{"kind":"Field","name":{"kind":"Name","value":"opdsUseBinaryFileSizes"}},{"kind":"Field","name":{"kind":"Name","value":"opdsItemsPerPage"}},{"kind":"Field","name":{"kind":"Name","value":"opdsEnablePageReadProgress"}},{"kind":"Field","name":{"kind":"Name","value":"opdsMarkAsReadOnDownload"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyDownloadedChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsChapterSortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"opdsCbzMimetype"}},{"kind":"Field","name":{"kind":"Name","value":"opdsSkipChapterMetadataFeed"}}]}}]} as unknown as DocumentNode<ServerSettingsQuery, ServerSettingsQueryVariables>;
export const SetServerSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetServerSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"settings"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PartialSettingsTypeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"settings"},"value":{"kind":"Variable","name":{"kind":"Name","value":"settings"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ServerSettings"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ServerSettings"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SettingsType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"globalUpdateInterval"}},{"kind":"Field","name":{"kind":"Name","value":"excludeUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"excludeNotStarted"}},{"kind":"Field","name":{"kind":"Name","value":"excludeCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"updateMangas"}},{"kind":"Field","name":{"kind":"Name","value":"downloadsPath"}},{"kind":"Field","name":{"kind":"Name","value":"downloadAsCbz"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadNewChaptersLimit"}},{"kind":"Field","name":{"kind":"Name","value":"excludeEntryWithUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoDownloadIgnoreReUploads"}},{"kind":"Field","name":{"kind":"Name","value":"downloadConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"serveConversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"compressionLevel"}}]}},{"kind":"Field","name":{"kind":"Name","value":"maxSourcesInParallel"}},{"kind":"Field","name":{"kind":"Name","value":"localSourcePath"}},{"kind":"Field","name":{"kind":"Name","value":"kcefEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrUrl"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrTimeout"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrSessionName"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrSessionTtl"}},{"kind":"Field","name":{"kind":"Name","value":"flareSolverrAsResponseFallback"}},{"kind":"Field","name":{"kind":"Name","value":"backupPath"}},{"kind":"Field","name":{"kind":"Name","value":"backupTime"}},{"kind":"Field","name":{"kind":"Name","value":"backupInterval"}},{"kind":"Field","name":{"kind":"Name","value":"backupTTL"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeManga"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeCategories"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeChapters"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeTracking"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeHistory"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeClientData"}},{"kind":"Field","name":{"kind":"Name","value":"autoBackupIncludeServerSettings"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"syncYomiHost"}},{"kind":"Field","name":{"kind":"Name","value":"syncInterval"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataManga"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataChapters"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataTracking"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataHistory"}},{"kind":"Field","name":{"kind":"Name","value":"syncDataCategories"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncChecksumMethod"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncPercentageTolerance"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyForward"}},{"kind":"Field","name":{"kind":"Name","value":"koreaderSyncStrategyBackward"}},{"kind":"Field","name":{"kind":"Name","value":"ip"}},{"kind":"Field","name":{"kind":"Name","value":"port"}},{"kind":"Field","name":{"kind":"Name","value":"authMode"}},{"kind":"Field","name":{"kind":"Name","value":"authUsername"}},{"kind":"Field","name":{"kind":"Name","value":"jwtTokenExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"jwtRefreshExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyVersion"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyHost"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyPort"}},{"kind":"Field","name":{"kind":"Name","value":"socksProxyUsername"}},{"kind":"Field","name":{"kind":"Name","value":"webUIFlavor"}},{"kind":"Field","name":{"kind":"Name","value":"webUIChannel"}},{"kind":"Field","name":{"kind":"Name","value":"webUIUpdateCheckInterval"}},{"kind":"Field","name":{"kind":"Name","value":"initialOpenInBrowserEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"systemTrayEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"debugLogsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFiles"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFileSize"}},{"kind":"Field","name":{"kind":"Name","value":"maxLogFolderSize"}},{"kind":"Field","name":{"kind":"Name","value":"databaseType"}},{"kind":"Field","name":{"kind":"Name","value":"databaseUrl"}},{"kind":"Field","name":{"kind":"Name","value":"databaseUsername"}},{"kind":"Field","name":{"kind":"Name","value":"useHikariConnectionPool"}},{"kind":"Field","name":{"kind":"Name","value":"opdsUseBinaryFileSizes"}},{"kind":"Field","name":{"kind":"Name","value":"opdsItemsPerPage"}},{"kind":"Field","name":{"kind":"Name","value":"opdsEnablePageReadProgress"}},{"kind":"Field","name":{"kind":"Name","value":"opdsMarkAsReadOnDownload"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyUnreadChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsShowOnlyDownloadedChapters"}},{"kind":"Field","name":{"kind":"Name","value":"opdsChapterSortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"opdsCbzMimetype"}},{"kind":"Field","name":{"kind":"Name","value":"opdsSkipChapterMetadataFeed"}}]}}]} as unknown as DocumentNode<SetServerSettingsMutation, SetServerSettingsMutationVariables>;
export const SettingsAboutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SettingsAbout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aboutServer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"buildType"}},{"kind":"Field","name":{"kind":"Name","value":"buildTime"}},{"kind":"Field","name":{"kind":"Name","value":"github"}},{"kind":"Field","name":{"kind":"Name","value":"discord"}},{"kind":"Field","name":{"kind":"Name","value":"platformInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"arch"}},{"kind":"Field","name":{"kind":"Name","value":"os"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"jvm"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"javaVersion"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SettingsAboutQuery, SettingsAboutQueryVariables>;
export const CheckServerUpdatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CheckServerUpdates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkForServerUpdates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"tag"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<CheckServerUpdatesQuery, CheckServerUpdatesQueryVariables>;
export const SetPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetPasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientMutationId"}}]}}]}}]} as unknown as DocumentNode<SetPasswordMutation, SetPasswordMutationVariables>;
export const CreateBackupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateBackup"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createBackup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode<CreateBackupMutation, CreateBackupMutationVariables>;
export const ValidateBackupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ValidateBackup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ValidateBackupInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"validateBackup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"missingSources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"missingTrackers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<ValidateBackupQuery, ValidateBackupQueryVariables>;
export const RestoreBackupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RestoreBackup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RestoreBackupInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restoreBackup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RestoreBackupMutation, RestoreBackupMutationVariables>;
export const RestoreStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RestoreStatus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restoreStatus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"mangaProgress"}},{"kind":"Field","name":{"kind":"Name","value":"totalManga"}}]}}]}}]} as unknown as DocumentNode<RestoreStatusQuery, RestoreStatusQueryVariables>;
export const ExtensionStoresDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExtensionStores"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extensionStores"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"badgeLabel"}},{"kind":"Field","name":{"kind":"Name","value":"isLegacy"}}]}}]}}]}}]} as unknown as DocumentNode<ExtensionStoresQuery, ExtensionStoresQueryVariables>;
export const AddExtensionStoreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddExtensionStore"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"url"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addExtensionStore"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"indexUrl"},"value":{"kind":"Variable","name":{"kind":"Name","value":"url"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"badgeLabel"}},{"kind":"Field","name":{"kind":"Name","value":"isLegacy"}}]}}]}}]}}]} as unknown as DocumentNode<AddExtensionStoreMutation, AddExtensionStoreMutationVariables>;
export const RemoveExtensionStoreDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RemoveExtensionStore"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"url"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"removeExtensionStore"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"indexUrl"},"value":{"kind":"Variable","name":{"kind":"Name","value":"url"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extensionStore"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"indexUrl"}}]}}]}}]}}]} as unknown as DocumentNode<RemoveExtensionStoreMutation, RemoveExtensionStoreMutationVariables>;
export const ClearCookiesAndCacheDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ClearCookiesAndCache"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clearCookiesAndCache"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientMutationId"}}]}}]}}]} as unknown as DocumentNode<ClearCookiesAndCacheMutation, ClearCookiesAndCacheMutationVariables>;
export const ClearCachedImagesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ClearCachedImages"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ClearCachedImagesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clearCachedImages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cachedPages"}},{"kind":"Field","name":{"kind":"Name","value":"cachedThumbnails"}},{"kind":"Field","name":{"kind":"Name","value":"downloadedThumbnails"}}]}}]}}]} as unknown as DocumentNode<ClearCachedImagesMutation, ClearCachedImagesMutationVariables>;
export const LastSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LastSync"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lastSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}}]}}]}}]} as unknown as DocumentNode<LastSyncQuery, LastSyncQueryVariables>;
export const StartSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartSync"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startSync"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"result"}}]}}]}}]} as unknown as DocumentNode<StartSyncMutation, StartSyncMutationVariables>;
export const KoSyncStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"KoSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"koSyncStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"serverAddress"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]} as unknown as DocumentNode<KoSyncStatusQuery, KoSyncStatusQueryVariables>;
export const ConnectKoSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConnectKoSync"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ConnectKoSyncAccountInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"connectKoSyncAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"status"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"serverAddress"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<ConnectKoSyncMutation, ConnectKoSyncMutationVariables>;
export const LogoutKoSyncDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutKoSync"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutKoSyncAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"serverAddress"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<LogoutKoSyncMutation, LogoutKoSyncMutationVariables>;
export const UsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"roles"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"}}]}}]}}]}}]} as unknown as DocumentNode<UsersQuery, UsersQueryVariables>;
export const UserCodesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserCodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userCodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<UserCodesQuery, UserCodesQueryVariables>;
export const CreateRegistrationCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRegistrationCode"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRegistrationCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<CreateRegistrationCodeMutation, CreateRegistrationCodeMutationVariables>;
export const CreateRecoveryCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRecoveryCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRecoveryCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<CreateRecoveryCodeMutation, CreateRecoveryCodeMutationVariables>;
export const RevokeUserCodeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevokeUserCode"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revokeUserCode"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientMutationId"}}]}}]}}]} as unknown as DocumentNode<RevokeUserCodeMutation, RevokeUserCodeMutationVariables>;
export const UpdateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"roles"}},{"kind":"Field","name":{"kind":"Name","value":"permissions"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateUserMutation, UpdateUserMutationVariables>;
export const RegisterUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"register"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientMutationId"}}]}}]}}]} as unknown as DocumentNode<RegisterUserMutation, RegisterUserMutationVariables>;
export const CreateShelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateShelf"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCategory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"includeInUpdate"},"value":{"kind":"EnumValue","value":"EXCLUDE"}},{"kind":"ObjectField","name":{"kind":"Name","value":"includeInDownload"},"value":{"kind":"EnumValue","value":"EXCLUDE"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"default"}},{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CreateShelfMutation, CreateShelfMutationVariables>;
export const TagShelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TagShelf"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setCategoryMeta"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"meta"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"categoryId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"value"},"value":{"kind":"StringValue","value":"1","block":false}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"categoryId"}},{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]} as unknown as DocumentNode<TagShelfMutation, TagShelfMutationVariables>;
export const TrackersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Trackers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackerFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"isTokenExpired"}},{"kind":"Field","name":{"kind":"Name","value":"authUrl"}},{"kind":"Field","name":{"kind":"Name","value":"supportsPrivateTracking"}},{"kind":"Field","name":{"kind":"Name","value":"supportsReadingDates"}},{"kind":"Field","name":{"kind":"Name","value":"supportsTrackDeletion"}},{"kind":"Field","name":{"kind":"Name","value":"scores"}},{"kind":"Field","name":{"kind":"Name","value":"statuses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<TrackersQuery, TrackersQueryVariables>;
export const MangaTracksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MangaTracks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manga"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackRecords"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackRecordFields"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackRecordType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"lastChapterRead"}},{"kind":"Field","name":{"kind":"Name","value":"totalChapters"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"finishDate"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<MangaTracksQuery, MangaTracksQueryVariables>;
export const TrackedMangaIdsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TrackedMangaIds"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackRecords"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"mangaId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}}]}}]}}]}}]} as unknown as DocumentNode<TrackedMangaIdsQuery, TrackedMangaIdsQueryVariables>;
export const SearchTrackerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchTracker"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchTracker"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"trackerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackSearches"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackSearchFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackSearchFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackSearchType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"remoteId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"coverUrl"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"publishingStatus"}},{"kind":"Field","name":{"kind":"Name","value":"publishingType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"totalChapters"}},{"kind":"Field","name":{"kind":"Name","value":"trackingUrl"}}]}}]} as unknown as DocumentNode<SearchTrackerQuery, SearchTrackerQueryVariables>;
export const BindTrackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"BindTrack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mangaId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"remoteId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LongString"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"private"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bindTrack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"mangaId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mangaId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"trackerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"remoteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"remoteId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"private"},"value":{"kind":"Variable","name":{"kind":"Name","value":"private"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackRecord"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackRecordFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackRecordType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"lastChapterRead"}},{"kind":"Field","name":{"kind":"Name","value":"totalChapters"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"finishDate"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<BindTrackMutation, BindTrackMutationVariables>;
export const UpdateTrackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTrack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTrackInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTrack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackRecord"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackRecordFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackRecordType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"lastChapterRead"}},{"kind":"Field","name":{"kind":"Name","value":"totalChapters"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"finishDate"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<UpdateTrackMutation, UpdateTrackMutationVariables>;
export const FetchTrackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FetchTrack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"fetchTrack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"recordId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackRecord"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackRecordFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackRecordType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"trackerId"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteId"}},{"kind":"Field","name":{"kind":"Name","value":"remoteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"lastChapterRead"}},{"kind":"Field","name":{"kind":"Name","value":"totalChapters"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"displayScore"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"finishDate"}},{"kind":"Field","name":{"kind":"Name","value":"private"}}]}}]} as unknown as DocumentNode<FetchTrackMutation, FetchTrackMutationVariables>;
export const UnbindTrackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnbindTrack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteRemoteTrack"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unbindTrack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"recordId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recordId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"deleteRemoteTrack"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteRemoteTrack"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"trackRecord"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<UnbindTrackMutation, UnbindTrackMutationVariables>;
export const LoginTrackerOAuthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginTrackerOAuth"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"callbackUrl"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginTrackerOAuth"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"trackerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"callbackUrl"},"value":{"kind":"Variable","name":{"kind":"Name","value":"callbackUrl"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"tracker"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackerFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"isTokenExpired"}},{"kind":"Field","name":{"kind":"Name","value":"authUrl"}},{"kind":"Field","name":{"kind":"Name","value":"supportsPrivateTracking"}},{"kind":"Field","name":{"kind":"Name","value":"supportsReadingDates"}},{"kind":"Field","name":{"kind":"Name","value":"supportsTrackDeletion"}},{"kind":"Field","name":{"kind":"Name","value":"scores"}},{"kind":"Field","name":{"kind":"Name","value":"statuses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<LoginTrackerOAuthMutation, LoginTrackerOAuthMutationVariables>;
export const LoginTrackerCredentialsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginTrackerCredentials"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginTrackerCredentials"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"trackerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"tracker"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackerFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"isTokenExpired"}},{"kind":"Field","name":{"kind":"Name","value":"authUrl"}},{"kind":"Field","name":{"kind":"Name","value":"supportsPrivateTracking"}},{"kind":"Field","name":{"kind":"Name","value":"supportsReadingDates"}},{"kind":"Field","name":{"kind":"Name","value":"supportsTrackDeletion"}},{"kind":"Field","name":{"kind":"Name","value":"scores"}},{"kind":"Field","name":{"kind":"Name","value":"statuses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<LoginTrackerCredentialsMutation, LoginTrackerCredentialsMutationVariables>;
export const LogoutTrackerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutTracker"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutTracker"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"trackerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"trackerId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"tracker"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TrackerFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TrackerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TrackerType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"isLoggedIn"}},{"kind":"Field","name":{"kind":"Name","value":"isTokenExpired"}},{"kind":"Field","name":{"kind":"Name","value":"authUrl"}},{"kind":"Field","name":{"kind":"Name","value":"supportsPrivateTracking"}},{"kind":"Field","name":{"kind":"Name","value":"supportsReadingDates"}},{"kind":"Field","name":{"kind":"Name","value":"supportsTrackDeletion"}},{"kind":"Field","name":{"kind":"Name","value":"scores"}},{"kind":"Field","name":{"kind":"Name","value":"statuses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]} as unknown as DocumentNode<LogoutTrackerMutation, LogoutTrackerMutationVariables>;
export const LastUpdateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LastUpdate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lastUpdateTimestamp"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}}]}}]} as unknown as DocumentNode<LastUpdateQuery, LastUpdateQueryVariables>;
export const UpdatesFeedAllDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UpdatesFeedAll"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"FETCHED_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"SOURCE_ORDER"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"connection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"StringValue","value":"UpdatesFeedAll","block":false}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UpdatesFeedChapter"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UpdatesFeedChapter"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdatesFeedAllQuery, UpdatesFeedAllQueryVariables>;
export const UpdatesFeedUnreadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UpdatesFeedUnread"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"FETCHED_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"SOURCE_ORDER"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"connection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"StringValue","value":"UpdatesFeedUnread","block":false}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UpdatesFeedChapter"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UpdatesFeedChapter"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdatesFeedUnreadQuery, UpdatesFeedUnreadQueryVariables>;
export const UpdatesFeedDownloadedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UpdatesFeedDownloaded"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"FETCHED_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"SOURCE_ORDER"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"connection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"StringValue","value":"UpdatesFeedDownloaded","block":false}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UpdatesFeedChapter"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UpdatesFeedChapter"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdatesFeedDownloadedQuery, UpdatesFeedDownloadedQueryVariables>;
export const UpdatesFeedFavoriteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UpdatesFeedFavorite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"FETCHED_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"SOURCE_ORDER"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"connection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"StringValue","value":"UpdatesFeedFavorite","block":false}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UpdatesFeedChapter"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UpdatesFeedChapter"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterType"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"sourceOrder"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"isRead"}},{"kind":"Field","name":{"kind":"Name","value":"isDownloaded"}},{"kind":"Field","name":{"kind":"Name","value":"isBookmarked"}},{"kind":"Field","name":{"kind":"Name","value":"lastPageRead"}},{"kind":"Field","name":{"kind":"Name","value":"pageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"inLibraryAt"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UpdatesFeedFavoriteQuery, UpdatesFeedFavoriteQueryVariables>;
export const CalendarChaptersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CalendarChapters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChapterFilterInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"by"},"value":{"kind":"EnumValue","value":"FETCHED_AT"}},{"kind":"ObjectField","name":{"kind":"Name","value":"byType"},"value":{"kind":"EnumValue","value":"DESC"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mangaId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"uploadDate"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"thumbnailUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"updateStrategy"}},{"kind":"Field","name":{"kind":"Name","value":"source"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"contentWarning"}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<CalendarChaptersQuery, CalendarChaptersQueryVariables>;
export const UpdateIntervalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UpdateInterval"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"globalUpdateInterval"}}]}}]}}]} as unknown as DocumentNode<UpdateIntervalQuery, UpdateIntervalQueryVariables>;