/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n": typeof types.LoginDocument,
    "\n  query CurrentUser {\n    user {\n      id\n      username\n      roles\n      permissions\n    }\n  }\n": typeof types.CurrentUserDocument,
    "\n  mutation RedeemRegistrationCode($input: RedeemRegistrationCodeInput!) {\n    redeemRegistrationCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n": typeof types.RedeemRegistrationCodeDocument,
    "\n  mutation RedeemRecoveryCode($input: RedeemRecoveryCodeInput!) {\n    redeemRecoveryCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n": typeof types.RedeemRecoveryCodeDocument,
    "\n  mutation RefreshToken($input: RefreshTokenInput!) {\n    refreshToken(input: $input) {\n      accessToken\n    }\n  }\n": typeof types.RefreshTokenDocument,
    "\n  mutation UpdateChapters($ids: [Int!]!, $patch: UpdateChapterPatchInput!) {\n    updateChapters(input: { ids: $ids, patch: $patch }) {\n      chapters {\n        id\n        isRead\n        isBookmarked\n        lastPageRead\n        manga {\n          id\n          unreadCount\n          bookmarkCount\n        }\n      }\n    }\n  }\n": typeof types.UpdateChaptersDocument,
    "\n  mutation EnqueueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n": typeof types.EnqueueDownloadsDocument,
    "\n  mutation DeleteDownloads($ids: [Int!]!) {\n    deleteDownloadedChapters(input: { ids: $ids }) {\n      chapters {\n        id\n        isDownloaded\n        manga {\n          id\n          downloadCount\n        }\n      }\n    }\n  }\n": typeof types.DeleteDownloadsDocument,
    "\n  fragment DownloadItem on DownloadType {\n    progress\n    state\n    position\n    tries\n    chapter {\n      id\n      name\n      chapterNumber\n      mangaId\n      pageCount\n    }\n    manga {\n      id\n      title\n      thumbnailUrl\n    }\n  }\n": typeof types.DownloadItemFragmentDoc,
    "\n  subscription DownloadsChanged {\n    downloadStatusChanged(input: { maxUpdates: 50 }) {\n      state\n      omittedUpdates\n      initial {\n        ...DownloadItem\n      }\n      updates {\n        type\n        download {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": typeof types.DownloadsChangedDocument,
    "\n  query DownloadsSnapshot {\n    downloadStatus {\n      state\n      queue {\n        ...DownloadItem\n      }\n    }\n  }\n": typeof types.DownloadsSnapshotDocument,
    "\n  subscription UpdaterChanged {\n    libraryUpdateStatusChanged(input: { maxUpdates: 1 }) {\n      omittedUpdates\n      jobsInfo {\n        isRunning\n        finishedJobs\n        totalJobs\n      }\n    }\n  }\n": typeof types.UpdaterChangedDocument,
    "\n  mutation StartDownloader {\n    startDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n": typeof types.StartDownloaderDocument,
    "\n  mutation StopDownloader {\n    stopDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n": typeof types.StopDownloaderDocument,
    "\n  query AboutServer {\n    aboutServer {\n      name\n      version\n    }\n  }\n": typeof types.AboutServerDocument,
    "\n  query Sources {\n    sources {\n      nodes {\n        id\n        name\n        displayName\n        lang\n        iconUrl\n        supportsLatest\n        contentWarning\n        homeUrl\n      }\n    }\n  }\n": typeof types.SourcesDocument,
    "\n  mutation FetchSourceManga($source: LongString!, $type: FetchSourceMangaType!, $page: Int!, $query: String, $filters: [FilterChangeInput!]) {\n    fetchSourceManga(input: { source: $source, type: $type, page: $page, query: $query, filters: $filters }) {\n      hasNextPage\n      mangas {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n      }\n    }\n  }\n": typeof types.FetchSourceMangaDocument,
    "\n  fragment SourceFilterFields on Filter {\n    __typename\n    ... on TextFilter { name textDefault: default }\n    ... on CheckBoxFilter { name checkBoxDefault: default }\n    ... on TriStateFilter { name triStateDefault: default }\n    ... on SelectFilter { name values selectDefault: default }\n    ... on SortFilter { name values sortDefault: default { index ascending } }\n    ... on HeaderFilter { name }\n    ... on SeparatorFilter { name }\n    ... on GroupFilter { name }\n  }\n": typeof types.SourceFilterFieldsFragmentDoc,
    "\n  fragment SourceFilterLevel1 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterFields } }\n  }\n": typeof types.SourceFilterLevel1FragmentDoc,
    "\n  fragment SourceFilterLevel2 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel1 } }\n  }\n": typeof types.SourceFilterLevel2FragmentDoc,
    "\n  fragment SourceFilterLevel3 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel2 } }\n  }\n": typeof types.SourceFilterLevel3FragmentDoc,
    "\n  query SourceFilters($id: LongString!) {\n    source(id: $id) {\n      id\n      filters {\n        ...SourceFilterFields\n        ... on GroupFilter { filters { ...SourceFilterLevel3 } }\n      }\n    }\n  }\n": typeof types.SourceFiltersDocument,
    "\n  fragment ExtensionFields on ExtensionType {\n    pkgName\n    name\n    lang\n    versionName\n    iconUrl\n    isInstalled\n    hasUpdate\n    isObsolete\n    contentWarning\n    extensionStore {\n      indexUrl\n      name\n    }\n  }\n": typeof types.ExtensionFieldsFragmentDoc,
    "\n  query Extensions {\n    extensions {\n      nodes {\n        ...ExtensionFields\n      }\n    }\n  }\n": typeof types.ExtensionsDocument,
    "\n  mutation FetchExtensions {\n    fetchExtensions(input: {}) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n": typeof types.FetchExtensionsDocument,
    "\n  query ExtensionUpdateCount {\n    extensions(condition: { hasUpdate: true }) {\n      totalCount\n    }\n  }\n": typeof types.ExtensionUpdateCountDocument,
    "\n  mutation UpdateExtension($id: String!, $patch: UpdateExtensionPatchInput!) {\n    updateExtension(input: { id: $id, patch: $patch }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n": typeof types.UpdateExtensionDocument,
    "\n  mutation UpdateExtensions($ids: [String!]!) {\n    updateExtensions(input: { ids: $ids, patch: { update: true } }) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n": typeof types.UpdateExtensionsDocument,
    "\n  mutation InstallExternalExtension($file: Upload!) {\n    installExternalExtension(input: { extensionFile: $file }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n": typeof types.InstallExternalExtensionDocument,
    "\n  mutation DequeueDownloads($ids: [Int!]!) {\n    dequeueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": typeof types.DequeueDownloadsDocument,
    "\n  mutation RequeueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": typeof types.RequeueDownloadsDocument,
    "\n  mutation ReorderDownload($id: Int!, $to: Int!) {\n    reorderChapterDownload(input: { chapterId: $id, to: $to }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": typeof types.ReorderDownloadDocument,
    "\n  mutation ReorderDownloads($reorders: [ChapterDownloadReorderInput!]!) {\n    reorderChapterDownloads(input: { reorders: $reorders }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": typeof types.ReorderDownloadsDocument,
    "\n  mutation ClearDownloads {\n    clearDownloader(input: {}) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": typeof types.ClearDownloadsDocument,
    "\n  query History($first: Int!, $offset: Int!) {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: $first, offset: $offset) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n": typeof types.HistoryDocument,
    "\n  mutation HideHistory($ids: [Int!]!, $key: String!, $value: String!) {\n    setChapterMetas(input: { items: [{ chapterIds: $ids, metas: [{ key: $key, value: $value }] }] }) {\n      metas {\n        chapterId\n        key\n        value\n      }\n    }\n  }\n": typeof types.HideHistoryDocument,
    "\n  query RecentReads {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: 150) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        # 历史里删掉的记录（features/history）首页也不显示\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          author\n          genre\n          description\n          inLibrary\n          unreadCount\n          source {\n            id\n            displayName\n          }\n          firstUnreadChapter {\n            id\n            name\n            chapterNumber\n            lastPageRead\n            pageCount\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n": typeof types.RecentReadsDocument,
    "\n  query RecentUpdates($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {\n    chapters(\n      filter: $filter\n      order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]\n      first: $first\n      offset: $offset\n    ) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        fetchedAt\n        uploadDate\n        isRead\n        isDownloaded\n        isBookmarked\n        lastPageRead\n        pageCount\n        mangaId\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n": typeof types.RecentUpdatesDocument,
    "\n  query LibraryMangas {\n    mangas(condition: { inLibrary: true }) {\n      totalCount\n      nodes {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        genre\n        status\n        inLibraryAt\n        unreadCount\n        downloadCount\n        bookmarkCount\n        source {\n          id\n          displayName\n        }\n        categories {\n          nodes {\n            id\n          }\n        }\n        lastReadChapter {\n          id\n          lastReadAt\n        }\n        latestFetchedChapter {\n          id\n          fetchedAt\n        }\n        latestUploadedChapter {\n          id\n          uploadDate\n        }\n      }\n    }\n  }\n": typeof types.LibraryMangasDocument,
    "\n  query Categories {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n      }\n    }\n  }\n": typeof types.CategoriesDocument,
    "\n  mutation UpdateLibrary($categories: [Int!]) {\n    updateLibrary(input: { categories: $categories }) {\n      updateStatus {\n        jobsInfo {\n          isRunning\n          finishedJobs\n          totalJobs\n        }\n      }\n    }\n  }\n": typeof types.UpdateLibraryDocument,
    "\n  mutation SetInLibrary($ids: [Int!]!, $inLibrary: Boolean!) {\n    updateMangas(input: { ids: $ids, patch: { inLibrary: $inLibrary } }) {\n      mangas {\n        id\n        inLibrary\n      }\n    }\n  }\n": typeof types.SetInLibraryDocument,
    "\n  mutation SetMangasCategories($ids: [Int!]!, $add: [Int!], $remove: [Int!]) {\n    updateMangasCategories(input: { ids: $ids, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      mangas {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n": typeof types.SetMangasCategoriesDocument,
    "\n  query ChapterIds($filter: ChapterFilterInput!) {\n    chapters(filter: $filter) {\n      nodes {\n        id\n      }\n    }\n  }\n": typeof types.ChapterIdsDocument,
    "\n  query MangaDetail($id: Int!) {\n    manga(id: $id) {\n      id\n      title\n      thumbnailUrl\n      author\n      artist\n      description\n      genre\n      status\n      realUrl\n      inLibrary\n      initialized\n      unreadCount\n      downloadCount\n      bookmarkCount\n      source {\n        id\n        displayName\n        lang\n      }\n      categories {\n        nodes {\n          id\n          default\n        }\n      }\n      lastReadChapter {\n        id\n        lastReadAt\n      }\n    }\n  }\n": typeof types.MangaDetailDocument,
    "\n  fragment MangaPeek on MangaType {\n    id\n    title\n    thumbnailUrl\n  }\n": typeof types.MangaPeekFragmentDoc,
    "\n  query MangaChapters($mangaId: Int!) {\n    chapters(condition: { mangaId: $mangaId }, order: [{ by: SOURCE_ORDER, byType: ASC }]) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        scanlator\n        uploadDate\n        isRead\n        isBookmarked\n        isDownloaded\n        lastPageRead\n        pageCount\n        lastReadAt\n      }\n    }\n  }\n": typeof types.MangaChaptersDocument,
    "\n  mutation FetchMangaAndChapters($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        description\n        genre\n        status\n        initialized\n        unreadCount\n        downloadCount\n      }\n    }\n  }\n": typeof types.FetchMangaAndChaptersDocument,
    "\n  mutation SetMangaInLibrary($id: Int!, $inLibrary: Boolean!) {\n    updateManga(input: { id: $id, patch: { inLibrary: $inLibrary } }) {\n      manga {\n        id\n        inLibrary\n      }\n    }\n  }\n": typeof types.SetMangaInLibraryDocument,
    "\n  mutation SetMangaCategories($id: Int!, $add: [Int!], $remove: [Int!]) {\n    updateMangaCategories(input: { id: $id, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      manga {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n": typeof types.SetMangaCategoriesDocument,
    "\n  mutation MigrationTarget($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n        source {\n          id\n          displayName\n        }\n      }\n      chapters {\n        id\n        chapterNumber\n        isRead\n        isBookmarked\n      }\n    }\n  }\n": typeof types.MigrationTargetDocument,
    "\n  mutation FetchChapterPages($chapterId: Int!) {\n    fetchChapterPages(input: { chapterId: $chapterId }) {\n      pages\n      chapter {\n        id\n        pageCount\n      }\n    }\n  }\n": typeof types.FetchChapterPagesDocument,
    "\n  mutation SaveProgress($id: Int!, $lastPageRead: Int!, $isRead: Boolean) {\n    updateChapter(input: { id: $id, patch: { lastPageRead: $lastPageRead, isRead: $isRead } }) {\n      chapter {\n        id\n        lastPageRead\n        isRead\n        lastReadAt\n        manga {\n          id\n          unreadCount\n          lastReadChapter {\n            id\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n": typeof types.SaveProgressDocument,
    "\n  query ReaderMangaMeta($id: Int!) {\n    manga(id: $id) {\n      id\n      meta {\n        key\n        value\n      }\n    }\n  }\n": typeof types.ReaderMangaMetaDocument,
    "\n  query ReaderMetaOf($ids: [Int!]!) {\n    mangas(filter: { id: { in: $ids } }) {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n": typeof types.ReaderMetaOfDocument,
    "\n  query ReaderMetaIndex {\n    mangas {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n": typeof types.ReaderMetaIndexDocument,
    "\n  mutation SetReaderMeta($items: [SetMangaMetasItemInput!]!) {\n    setMangaMetas(input: { items: $items }) {\n      metas {\n        mangaId\n        key\n        value\n      }\n    }\n  }\n": typeof types.SetReaderMetaDocument,
    "\n  mutation ClearReaderMeta($ids: [Int!]!, $prefixes: [String!]!) {\n    deleteMangaMetas(input: { items: [{ mangaIds: $ids, prefixes: $prefixes }] }) {\n      metas {\n        mangaId\n        key\n      }\n    }\n  }\n": typeof types.ClearReaderMetaDocument,
    "\n  query CategoriesFull {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n        includeInUpdate\n        mangas {\n          totalCount\n        }\n      }\n    }\n  }\n": typeof types.CategoriesFullDocument,
    "\n  mutation CreateCategory($name: String!) {\n    createCategory(input: { name: $name }) {\n      category {\n        id\n      }\n    }\n  }\n": typeof types.CreateCategoryDocument,
    "\n  mutation UpdateCategory($id: Int!, $patch: UpdateCategoryPatchInput!) {\n    updateCategory(input: { id: $id, patch: $patch }) {\n      category {\n        id\n        name\n        includeInUpdate\n      }\n    }\n  }\n": typeof types.UpdateCategoryDocument,
    "\n  mutation DeleteCategory($id: Int!) {\n    deleteCategory(input: { categoryId: $id }) {\n      category {\n        id\n      }\n    }\n  }\n": typeof types.DeleteCategoryDocument,
    "\n  mutation MoveCategory($id: Int!, $position: Int!) {\n    updateCategoryOrder(input: { id: $id, position: $position }) {\n      categories {\n        id\n        order\n      }\n    }\n  }\n": typeof types.MoveCategoryDocument,
    "\n  fragment ServerSettings on SettingsType {\n    # 书库更新\n    globalUpdateInterval\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    # 下载\n    downloadsPath\n    downloadAsCbz\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    downloadConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    # 来源与扩展\n    maxSourcesInParallel\n    localSourcePath\n    kcefEnabled\n    flareSolverrEnabled\n    flareSolverrUrl\n    flareSolverrTimeout\n    flareSolverrSessionName\n    flareSolverrSessionTtl\n    flareSolverrAsResponseFallback\n    # 备份\n    backupPath\n    backupTime\n    backupInterval\n    backupTTL\n    autoBackupIncludeManga\n    autoBackupIncludeCategories\n    autoBackupIncludeChapters\n    autoBackupIncludeTracking\n    autoBackupIncludeHistory\n    autoBackupIncludeClientData\n    autoBackupIncludeServerSettings\n    # 同步\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    # 服务器\n    ip\n    port\n    authMode\n    authUsername\n    jwtTokenExpiry\n    jwtRefreshExpiry\n    socksProxyEnabled\n    socksProxyVersion\n    socksProxyHost\n    socksProxyPort\n    socksProxyUsername\n    webUIFlavor\n    webUIChannel\n    webUIUpdateCheckInterval\n    initialOpenInBrowserEnabled\n    systemTrayEnabled\n    debugLogsEnabled\n    maxLogFiles\n    maxLogFileSize\n    maxLogFolderSize\n    databaseType\n    databaseUrl\n    databaseUsername\n    useHikariConnectionPool\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n": typeof types.ServerSettingsFragmentDoc,
    "\n  fragment UserSettings on UserSettingsType {\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n": typeof types.UserSettingsFragmentDoc,
    "\n  query MultiUserSettings {\n    settings {\n      autoBackupIncludeUserSettings\n    }\n  }\n": typeof types.MultiUserSettingsDocument,
    "\n  query UserSettings {\n    userSettings {\n      ...UserSettings\n    }\n  }\n": typeof types.UserSettingsDocument,
    "\n  mutation SetUserSettings($settings: PartialUserSettingsTypeInput!) {\n    setUserSettings(input: { userSettings: $settings }) {\n      userSettings {\n        ...UserSettings\n      }\n    }\n  }\n": typeof types.SetUserSettingsDocument,
    "\n  query ServerSettings {\n    settings {\n      ...ServerSettings\n    }\n  }\n": typeof types.ServerSettingsDocument,
    "\n  mutation SetServerSettings($settings: PartialSettingsTypeInput!) {\n    setSettings(input: { settings: $settings }) {\n      settings {\n        ...ServerSettings\n      }\n    }\n  }\n": typeof types.SetServerSettingsDocument,
    "\n  query SettingsAbout {\n    aboutServer {\n      name\n      version\n      buildType\n      buildTime\n      github\n      discord\n      platformInfo {\n        arch\n        os {\n          name\n          version\n        }\n        jvm {\n          javaVersion\n        }\n      }\n    }\n  }\n": typeof types.SettingsAboutDocument,
    "\n  query CheckServerUpdates {\n    checkForServerUpdates {\n      channel\n      tag\n      url\n    }\n  }\n": typeof types.CheckServerUpdatesDocument,
    "\n  mutation SetPassword($input: SetPasswordInput!) {\n    setPassword(input: $input) {\n      clientMutationId\n    }\n  }\n": typeof types.SetPasswordDocument,
    "\n  mutation CreateBackup {\n    createBackup(input: {}) {\n      url\n    }\n  }\n": typeof types.CreateBackupDocument,
    "\n  query ValidateBackup($input: ValidateBackupInput!) {\n    validateBackup(input: $input) {\n      missingSources {\n        id\n        name\n      }\n      missingTrackers {\n        name\n      }\n    }\n  }\n": typeof types.ValidateBackupDocument,
    "\n  mutation RestoreBackup($input: RestoreBackupInput!) {\n    restoreBackup(input: $input) {\n      id\n    }\n  }\n": typeof types.RestoreBackupDocument,
    "\n  query RestoreStatus($id: String!) {\n    restoreStatus(id: $id) {\n      state\n      mangaProgress\n      totalManga\n    }\n  }\n": typeof types.RestoreStatusDocument,
    "\n  query ExtensionStores {\n    extensionStores {\n      nodes {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n": typeof types.ExtensionStoresDocument,
    "\n  mutation AddExtensionStore($url: String!) {\n    addExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n": typeof types.AddExtensionStoreDocument,
    "\n  mutation RemoveExtensionStore($url: String!) {\n    removeExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n      }\n    }\n  }\n": typeof types.RemoveExtensionStoreDocument,
    "\n  mutation ClearCookiesAndCache {\n    clearCookiesAndCache(input: {}) {\n      clientMutationId\n    }\n  }\n": typeof types.ClearCookiesAndCacheDocument,
    "\n  mutation ClearCachedImages($input: ClearCachedImagesInput!) {\n    clearCachedImages(input: $input) {\n      cachedPages\n      cachedThumbnails\n      downloadedThumbnails\n    }\n  }\n": typeof types.ClearCachedImagesDocument,
    "\n  query LastSync {\n    lastSyncStatus {\n      state\n      startDate\n      endDate\n      errorMessage\n    }\n  }\n": typeof types.LastSyncDocument,
    "\n  mutation StartSync {\n    startSync(input: {}) {\n      result\n    }\n  }\n": typeof types.StartSyncDocument,
    "\n  query KoSyncStatus {\n    koSyncStatus {\n      isLoggedIn\n      serverAddress\n      username\n    }\n  }\n": typeof types.KoSyncStatusDocument,
    "\n  mutation ConnectKoSync($input: ConnectKoSyncAccountInput!) {\n    connectKoSyncAccount(input: $input) {\n      message\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n": typeof types.ConnectKoSyncDocument,
    "\n  mutation LogoutKoSync {\n    logoutKoSyncAccount(input: {}) {\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n": typeof types.LogoutKoSyncDocument,
    "\n  query Users {\n    users {\n      nodes {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n": typeof types.UsersDocument,
    "\n  query UserCodes {\n    userCodes {\n      id\n      purpose\n      expiresAt\n      createdBy {\n        id\n        username\n      }\n      user {\n        id\n        username\n      }\n    }\n  }\n": typeof types.UserCodesDocument,
    "\n  mutation CreateRegistrationCode {\n    createRegistrationCode(input: {}) {\n      code\n      expiresAt\n    }\n  }\n": typeof types.CreateRegistrationCodeDocument,
    "\n  mutation CreateRecoveryCode($userId: Int!) {\n    createRecoveryCode(input: { userId: $userId }) {\n      code\n      expiresAt\n    }\n  }\n": typeof types.CreateRecoveryCodeDocument,
    "\n  mutation RevokeUserCode($id: Int!) {\n    revokeUserCode(input: { id: $id }) {\n      clientMutationId\n    }\n  }\n": typeof types.RevokeUserCodeDocument,
    "\n  mutation UpdateUser($input: UpdateUserInput!) {\n    updateUser(input: $input) {\n      user {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n": typeof types.UpdateUserDocument,
    "\n  mutation RegisterUser($input: RegisterInput!) {\n    register(input: $input) {\n      clientMutationId\n    }\n  }\n": typeof types.RegisterUserDocument,
    "\n  fragment TrackerFields on TrackerType {\n    id\n    name\n    icon\n    isLoggedIn\n    isTokenExpired\n    authUrl\n    supportsPrivateTracking\n    supportsReadingDates\n    supportsTrackDeletion\n    scores\n    statuses {\n      name\n      value\n    }\n  }\n": typeof types.TrackerFieldsFragmentDoc,
    "\n  fragment TrackRecordFields on TrackRecordType {\n    id\n    trackerId\n    mangaId\n    remoteId\n    remoteUrl\n    title\n    status\n    lastChapterRead\n    totalChapters\n    score\n    displayScore\n    startDate\n    finishDate\n    private\n  }\n": typeof types.TrackRecordFieldsFragmentDoc,
    "\n  fragment TrackSearchFields on TrackSearchType {\n    id\n    remoteId\n    title\n    coverUrl\n    summary\n    publishingStatus\n    publishingType\n    startDate\n    totalChapters\n    trackingUrl\n  }\n": typeof types.TrackSearchFieldsFragmentDoc,
    "\n  query Trackers {\n    trackers {\n      nodes {\n        ...TrackerFields\n      }\n    }\n  }\n": typeof types.TrackersDocument,
    "\n  query MangaTracks($id: Int!) {\n    manga(id: $id) {\n      id\n      trackRecords {\n        nodes {\n          ...TrackRecordFields\n        }\n      }\n    }\n  }\n": typeof types.MangaTracksDocument,
    "\n  query SearchTracker($trackerId: Int!, $query: String!) {\n    searchTracker(input: { trackerId: $trackerId, query: $query }) {\n      trackSearches {\n        ...TrackSearchFields\n      }\n    }\n  }\n": typeof types.SearchTrackerDocument,
    "\n  mutation BindTrack($mangaId: Int!, $trackerId: Int!, $remoteId: LongString!, $private: Boolean) {\n    bindTrack(input: { mangaId: $mangaId, trackerId: $trackerId, remoteId: $remoteId, private: $private }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n": typeof types.BindTrackDocument,
    "\n  mutation UpdateTrack($input: UpdateTrackInput!) {\n    updateTrack(input: $input) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n": typeof types.UpdateTrackDocument,
    "\n  mutation FetchTrack($recordId: Int!) {\n    fetchTrack(input: { recordId: $recordId }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n": typeof types.FetchTrackDocument,
    "\n  mutation UnbindTrack($recordId: Int!, $deleteRemoteTrack: Boolean) {\n    unbindTrack(input: { recordId: $recordId, deleteRemoteTrack: $deleteRemoteTrack }) {\n      trackRecord {\n        id\n      }\n    }\n  }\n": typeof types.UnbindTrackDocument,
    "\n  mutation TrackProgress($mangaId: Int!) {\n    trackProgress(input: { mangaId: $mangaId }) {\n      trackRecords {\n        ...TrackRecordFields\n      }\n    }\n  }\n": typeof types.TrackProgressDocument,
    "\n  mutation LoginTrackerOAuth($trackerId: Int!, $callbackUrl: String!) {\n    loginTrackerOAuth(input: { trackerId: $trackerId, callbackUrl: $callbackUrl }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n": typeof types.LoginTrackerOAuthDocument,
    "\n  mutation LoginTrackerCredentials($trackerId: Int!, $username: String!, $password: String!) {\n    loginTrackerCredentials(input: { trackerId: $trackerId, username: $username, password: $password }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n": typeof types.LoginTrackerCredentialsDocument,
    "\n  mutation LogoutTracker($trackerId: Int!) {\n    logoutTracker(input: { trackerId: $trackerId }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n": typeof types.LogoutTrackerDocument,
    "\n  query LastUpdate {\n    lastUpdateTimestamp {\n      timestamp\n    }\n  }\n": typeof types.LastUpdateDocument,
};
const documents: Documents = {
    "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n": types.LoginDocument,
    "\n  query CurrentUser {\n    user {\n      id\n      username\n      roles\n      permissions\n    }\n  }\n": types.CurrentUserDocument,
    "\n  mutation RedeemRegistrationCode($input: RedeemRegistrationCodeInput!) {\n    redeemRegistrationCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n": types.RedeemRegistrationCodeDocument,
    "\n  mutation RedeemRecoveryCode($input: RedeemRecoveryCodeInput!) {\n    redeemRecoveryCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n": types.RedeemRecoveryCodeDocument,
    "\n  mutation RefreshToken($input: RefreshTokenInput!) {\n    refreshToken(input: $input) {\n      accessToken\n    }\n  }\n": types.RefreshTokenDocument,
    "\n  mutation UpdateChapters($ids: [Int!]!, $patch: UpdateChapterPatchInput!) {\n    updateChapters(input: { ids: $ids, patch: $patch }) {\n      chapters {\n        id\n        isRead\n        isBookmarked\n        lastPageRead\n        manga {\n          id\n          unreadCount\n          bookmarkCount\n        }\n      }\n    }\n  }\n": types.UpdateChaptersDocument,
    "\n  mutation EnqueueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n": types.EnqueueDownloadsDocument,
    "\n  mutation DeleteDownloads($ids: [Int!]!) {\n    deleteDownloadedChapters(input: { ids: $ids }) {\n      chapters {\n        id\n        isDownloaded\n        manga {\n          id\n          downloadCount\n        }\n      }\n    }\n  }\n": types.DeleteDownloadsDocument,
    "\n  fragment DownloadItem on DownloadType {\n    progress\n    state\n    position\n    tries\n    chapter {\n      id\n      name\n      chapterNumber\n      mangaId\n      pageCount\n    }\n    manga {\n      id\n      title\n      thumbnailUrl\n    }\n  }\n": types.DownloadItemFragmentDoc,
    "\n  subscription DownloadsChanged {\n    downloadStatusChanged(input: { maxUpdates: 50 }) {\n      state\n      omittedUpdates\n      initial {\n        ...DownloadItem\n      }\n      updates {\n        type\n        download {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": types.DownloadsChangedDocument,
    "\n  query DownloadsSnapshot {\n    downloadStatus {\n      state\n      queue {\n        ...DownloadItem\n      }\n    }\n  }\n": types.DownloadsSnapshotDocument,
    "\n  subscription UpdaterChanged {\n    libraryUpdateStatusChanged(input: { maxUpdates: 1 }) {\n      omittedUpdates\n      jobsInfo {\n        isRunning\n        finishedJobs\n        totalJobs\n      }\n    }\n  }\n": types.UpdaterChangedDocument,
    "\n  mutation StartDownloader {\n    startDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n": types.StartDownloaderDocument,
    "\n  mutation StopDownloader {\n    stopDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n": types.StopDownloaderDocument,
    "\n  query AboutServer {\n    aboutServer {\n      name\n      version\n    }\n  }\n": types.AboutServerDocument,
    "\n  query Sources {\n    sources {\n      nodes {\n        id\n        name\n        displayName\n        lang\n        iconUrl\n        supportsLatest\n        contentWarning\n        homeUrl\n      }\n    }\n  }\n": types.SourcesDocument,
    "\n  mutation FetchSourceManga($source: LongString!, $type: FetchSourceMangaType!, $page: Int!, $query: String, $filters: [FilterChangeInput!]) {\n    fetchSourceManga(input: { source: $source, type: $type, page: $page, query: $query, filters: $filters }) {\n      hasNextPage\n      mangas {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n      }\n    }\n  }\n": types.FetchSourceMangaDocument,
    "\n  fragment SourceFilterFields on Filter {\n    __typename\n    ... on TextFilter { name textDefault: default }\n    ... on CheckBoxFilter { name checkBoxDefault: default }\n    ... on TriStateFilter { name triStateDefault: default }\n    ... on SelectFilter { name values selectDefault: default }\n    ... on SortFilter { name values sortDefault: default { index ascending } }\n    ... on HeaderFilter { name }\n    ... on SeparatorFilter { name }\n    ... on GroupFilter { name }\n  }\n": types.SourceFilterFieldsFragmentDoc,
    "\n  fragment SourceFilterLevel1 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterFields } }\n  }\n": types.SourceFilterLevel1FragmentDoc,
    "\n  fragment SourceFilterLevel2 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel1 } }\n  }\n": types.SourceFilterLevel2FragmentDoc,
    "\n  fragment SourceFilterLevel3 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel2 } }\n  }\n": types.SourceFilterLevel3FragmentDoc,
    "\n  query SourceFilters($id: LongString!) {\n    source(id: $id) {\n      id\n      filters {\n        ...SourceFilterFields\n        ... on GroupFilter { filters { ...SourceFilterLevel3 } }\n      }\n    }\n  }\n": types.SourceFiltersDocument,
    "\n  fragment ExtensionFields on ExtensionType {\n    pkgName\n    name\n    lang\n    versionName\n    iconUrl\n    isInstalled\n    hasUpdate\n    isObsolete\n    contentWarning\n    extensionStore {\n      indexUrl\n      name\n    }\n  }\n": types.ExtensionFieldsFragmentDoc,
    "\n  query Extensions {\n    extensions {\n      nodes {\n        ...ExtensionFields\n      }\n    }\n  }\n": types.ExtensionsDocument,
    "\n  mutation FetchExtensions {\n    fetchExtensions(input: {}) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n": types.FetchExtensionsDocument,
    "\n  query ExtensionUpdateCount {\n    extensions(condition: { hasUpdate: true }) {\n      totalCount\n    }\n  }\n": types.ExtensionUpdateCountDocument,
    "\n  mutation UpdateExtension($id: String!, $patch: UpdateExtensionPatchInput!) {\n    updateExtension(input: { id: $id, patch: $patch }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n": types.UpdateExtensionDocument,
    "\n  mutation UpdateExtensions($ids: [String!]!) {\n    updateExtensions(input: { ids: $ids, patch: { update: true } }) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n": types.UpdateExtensionsDocument,
    "\n  mutation InstallExternalExtension($file: Upload!) {\n    installExternalExtension(input: { extensionFile: $file }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n": types.InstallExternalExtensionDocument,
    "\n  mutation DequeueDownloads($ids: [Int!]!) {\n    dequeueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": types.DequeueDownloadsDocument,
    "\n  mutation RequeueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": types.RequeueDownloadsDocument,
    "\n  mutation ReorderDownload($id: Int!, $to: Int!) {\n    reorderChapterDownload(input: { chapterId: $id, to: $to }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": types.ReorderDownloadDocument,
    "\n  mutation ReorderDownloads($reorders: [ChapterDownloadReorderInput!]!) {\n    reorderChapterDownloads(input: { reorders: $reorders }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": types.ReorderDownloadsDocument,
    "\n  mutation ClearDownloads {\n    clearDownloader(input: {}) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n": types.ClearDownloadsDocument,
    "\n  query History($first: Int!, $offset: Int!) {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: $first, offset: $offset) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n": types.HistoryDocument,
    "\n  mutation HideHistory($ids: [Int!]!, $key: String!, $value: String!) {\n    setChapterMetas(input: { items: [{ chapterIds: $ids, metas: [{ key: $key, value: $value }] }] }) {\n      metas {\n        chapterId\n        key\n        value\n      }\n    }\n  }\n": types.HideHistoryDocument,
    "\n  query RecentReads {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: 150) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        # 历史里删掉的记录（features/history）首页也不显示\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          author\n          genre\n          description\n          inLibrary\n          unreadCount\n          source {\n            id\n            displayName\n          }\n          firstUnreadChapter {\n            id\n            name\n            chapterNumber\n            lastPageRead\n            pageCount\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n": types.RecentReadsDocument,
    "\n  query RecentUpdates($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {\n    chapters(\n      filter: $filter\n      order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]\n      first: $first\n      offset: $offset\n    ) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        fetchedAt\n        uploadDate\n        isRead\n        isDownloaded\n        isBookmarked\n        lastPageRead\n        pageCount\n        mangaId\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n": types.RecentUpdatesDocument,
    "\n  query LibraryMangas {\n    mangas(condition: { inLibrary: true }) {\n      totalCount\n      nodes {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        genre\n        status\n        inLibraryAt\n        unreadCount\n        downloadCount\n        bookmarkCount\n        source {\n          id\n          displayName\n        }\n        categories {\n          nodes {\n            id\n          }\n        }\n        lastReadChapter {\n          id\n          lastReadAt\n        }\n        latestFetchedChapter {\n          id\n          fetchedAt\n        }\n        latestUploadedChapter {\n          id\n          uploadDate\n        }\n      }\n    }\n  }\n": types.LibraryMangasDocument,
    "\n  query Categories {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n      }\n    }\n  }\n": types.CategoriesDocument,
    "\n  mutation UpdateLibrary($categories: [Int!]) {\n    updateLibrary(input: { categories: $categories }) {\n      updateStatus {\n        jobsInfo {\n          isRunning\n          finishedJobs\n          totalJobs\n        }\n      }\n    }\n  }\n": types.UpdateLibraryDocument,
    "\n  mutation SetInLibrary($ids: [Int!]!, $inLibrary: Boolean!) {\n    updateMangas(input: { ids: $ids, patch: { inLibrary: $inLibrary } }) {\n      mangas {\n        id\n        inLibrary\n      }\n    }\n  }\n": types.SetInLibraryDocument,
    "\n  mutation SetMangasCategories($ids: [Int!]!, $add: [Int!], $remove: [Int!]) {\n    updateMangasCategories(input: { ids: $ids, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      mangas {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n": types.SetMangasCategoriesDocument,
    "\n  query ChapterIds($filter: ChapterFilterInput!) {\n    chapters(filter: $filter) {\n      nodes {\n        id\n      }\n    }\n  }\n": types.ChapterIdsDocument,
    "\n  query MangaDetail($id: Int!) {\n    manga(id: $id) {\n      id\n      title\n      thumbnailUrl\n      author\n      artist\n      description\n      genre\n      status\n      realUrl\n      inLibrary\n      initialized\n      unreadCount\n      downloadCount\n      bookmarkCount\n      source {\n        id\n        displayName\n        lang\n      }\n      categories {\n        nodes {\n          id\n          default\n        }\n      }\n      lastReadChapter {\n        id\n        lastReadAt\n      }\n    }\n  }\n": types.MangaDetailDocument,
    "\n  fragment MangaPeek on MangaType {\n    id\n    title\n    thumbnailUrl\n  }\n": types.MangaPeekFragmentDoc,
    "\n  query MangaChapters($mangaId: Int!) {\n    chapters(condition: { mangaId: $mangaId }, order: [{ by: SOURCE_ORDER, byType: ASC }]) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        scanlator\n        uploadDate\n        isRead\n        isBookmarked\n        isDownloaded\n        lastPageRead\n        pageCount\n        lastReadAt\n      }\n    }\n  }\n": types.MangaChaptersDocument,
    "\n  mutation FetchMangaAndChapters($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        description\n        genre\n        status\n        initialized\n        unreadCount\n        downloadCount\n      }\n    }\n  }\n": types.FetchMangaAndChaptersDocument,
    "\n  mutation SetMangaInLibrary($id: Int!, $inLibrary: Boolean!) {\n    updateManga(input: { id: $id, patch: { inLibrary: $inLibrary } }) {\n      manga {\n        id\n        inLibrary\n      }\n    }\n  }\n": types.SetMangaInLibraryDocument,
    "\n  mutation SetMangaCategories($id: Int!, $add: [Int!], $remove: [Int!]) {\n    updateMangaCategories(input: { id: $id, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      manga {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n": types.SetMangaCategoriesDocument,
    "\n  mutation MigrationTarget($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n        source {\n          id\n          displayName\n        }\n      }\n      chapters {\n        id\n        chapterNumber\n        isRead\n        isBookmarked\n      }\n    }\n  }\n": types.MigrationTargetDocument,
    "\n  mutation FetchChapterPages($chapterId: Int!) {\n    fetchChapterPages(input: { chapterId: $chapterId }) {\n      pages\n      chapter {\n        id\n        pageCount\n      }\n    }\n  }\n": types.FetchChapterPagesDocument,
    "\n  mutation SaveProgress($id: Int!, $lastPageRead: Int!, $isRead: Boolean) {\n    updateChapter(input: { id: $id, patch: { lastPageRead: $lastPageRead, isRead: $isRead } }) {\n      chapter {\n        id\n        lastPageRead\n        isRead\n        lastReadAt\n        manga {\n          id\n          unreadCount\n          lastReadChapter {\n            id\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n": types.SaveProgressDocument,
    "\n  query ReaderMangaMeta($id: Int!) {\n    manga(id: $id) {\n      id\n      meta {\n        key\n        value\n      }\n    }\n  }\n": types.ReaderMangaMetaDocument,
    "\n  query ReaderMetaOf($ids: [Int!]!) {\n    mangas(filter: { id: { in: $ids } }) {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n": types.ReaderMetaOfDocument,
    "\n  query ReaderMetaIndex {\n    mangas {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n": types.ReaderMetaIndexDocument,
    "\n  mutation SetReaderMeta($items: [SetMangaMetasItemInput!]!) {\n    setMangaMetas(input: { items: $items }) {\n      metas {\n        mangaId\n        key\n        value\n      }\n    }\n  }\n": types.SetReaderMetaDocument,
    "\n  mutation ClearReaderMeta($ids: [Int!]!, $prefixes: [String!]!) {\n    deleteMangaMetas(input: { items: [{ mangaIds: $ids, prefixes: $prefixes }] }) {\n      metas {\n        mangaId\n        key\n      }\n    }\n  }\n": types.ClearReaderMetaDocument,
    "\n  query CategoriesFull {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n        includeInUpdate\n        mangas {\n          totalCount\n        }\n      }\n    }\n  }\n": types.CategoriesFullDocument,
    "\n  mutation CreateCategory($name: String!) {\n    createCategory(input: { name: $name }) {\n      category {\n        id\n      }\n    }\n  }\n": types.CreateCategoryDocument,
    "\n  mutation UpdateCategory($id: Int!, $patch: UpdateCategoryPatchInput!) {\n    updateCategory(input: { id: $id, patch: $patch }) {\n      category {\n        id\n        name\n        includeInUpdate\n      }\n    }\n  }\n": types.UpdateCategoryDocument,
    "\n  mutation DeleteCategory($id: Int!) {\n    deleteCategory(input: { categoryId: $id }) {\n      category {\n        id\n      }\n    }\n  }\n": types.DeleteCategoryDocument,
    "\n  mutation MoveCategory($id: Int!, $position: Int!) {\n    updateCategoryOrder(input: { id: $id, position: $position }) {\n      categories {\n        id\n        order\n      }\n    }\n  }\n": types.MoveCategoryDocument,
    "\n  fragment ServerSettings on SettingsType {\n    # 书库更新\n    globalUpdateInterval\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    # 下载\n    downloadsPath\n    downloadAsCbz\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    downloadConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    # 来源与扩展\n    maxSourcesInParallel\n    localSourcePath\n    kcefEnabled\n    flareSolverrEnabled\n    flareSolverrUrl\n    flareSolverrTimeout\n    flareSolverrSessionName\n    flareSolverrSessionTtl\n    flareSolverrAsResponseFallback\n    # 备份\n    backupPath\n    backupTime\n    backupInterval\n    backupTTL\n    autoBackupIncludeManga\n    autoBackupIncludeCategories\n    autoBackupIncludeChapters\n    autoBackupIncludeTracking\n    autoBackupIncludeHistory\n    autoBackupIncludeClientData\n    autoBackupIncludeServerSettings\n    # 同步\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    # 服务器\n    ip\n    port\n    authMode\n    authUsername\n    jwtTokenExpiry\n    jwtRefreshExpiry\n    socksProxyEnabled\n    socksProxyVersion\n    socksProxyHost\n    socksProxyPort\n    socksProxyUsername\n    webUIFlavor\n    webUIChannel\n    webUIUpdateCheckInterval\n    initialOpenInBrowserEnabled\n    systemTrayEnabled\n    debugLogsEnabled\n    maxLogFiles\n    maxLogFileSize\n    maxLogFolderSize\n    databaseType\n    databaseUrl\n    databaseUsername\n    useHikariConnectionPool\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n": types.ServerSettingsFragmentDoc,
    "\n  fragment UserSettings on UserSettingsType {\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n": types.UserSettingsFragmentDoc,
    "\n  query MultiUserSettings {\n    settings {\n      autoBackupIncludeUserSettings\n    }\n  }\n": types.MultiUserSettingsDocument,
    "\n  query UserSettings {\n    userSettings {\n      ...UserSettings\n    }\n  }\n": types.UserSettingsDocument,
    "\n  mutation SetUserSettings($settings: PartialUserSettingsTypeInput!) {\n    setUserSettings(input: { userSettings: $settings }) {\n      userSettings {\n        ...UserSettings\n      }\n    }\n  }\n": types.SetUserSettingsDocument,
    "\n  query ServerSettings {\n    settings {\n      ...ServerSettings\n    }\n  }\n": types.ServerSettingsDocument,
    "\n  mutation SetServerSettings($settings: PartialSettingsTypeInput!) {\n    setSettings(input: { settings: $settings }) {\n      settings {\n        ...ServerSettings\n      }\n    }\n  }\n": types.SetServerSettingsDocument,
    "\n  query SettingsAbout {\n    aboutServer {\n      name\n      version\n      buildType\n      buildTime\n      github\n      discord\n      platformInfo {\n        arch\n        os {\n          name\n          version\n        }\n        jvm {\n          javaVersion\n        }\n      }\n    }\n  }\n": types.SettingsAboutDocument,
    "\n  query CheckServerUpdates {\n    checkForServerUpdates {\n      channel\n      tag\n      url\n    }\n  }\n": types.CheckServerUpdatesDocument,
    "\n  mutation SetPassword($input: SetPasswordInput!) {\n    setPassword(input: $input) {\n      clientMutationId\n    }\n  }\n": types.SetPasswordDocument,
    "\n  mutation CreateBackup {\n    createBackup(input: {}) {\n      url\n    }\n  }\n": types.CreateBackupDocument,
    "\n  query ValidateBackup($input: ValidateBackupInput!) {\n    validateBackup(input: $input) {\n      missingSources {\n        id\n        name\n      }\n      missingTrackers {\n        name\n      }\n    }\n  }\n": types.ValidateBackupDocument,
    "\n  mutation RestoreBackup($input: RestoreBackupInput!) {\n    restoreBackup(input: $input) {\n      id\n    }\n  }\n": types.RestoreBackupDocument,
    "\n  query RestoreStatus($id: String!) {\n    restoreStatus(id: $id) {\n      state\n      mangaProgress\n      totalManga\n    }\n  }\n": types.RestoreStatusDocument,
    "\n  query ExtensionStores {\n    extensionStores {\n      nodes {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n": types.ExtensionStoresDocument,
    "\n  mutation AddExtensionStore($url: String!) {\n    addExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n": types.AddExtensionStoreDocument,
    "\n  mutation RemoveExtensionStore($url: String!) {\n    removeExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n      }\n    }\n  }\n": types.RemoveExtensionStoreDocument,
    "\n  mutation ClearCookiesAndCache {\n    clearCookiesAndCache(input: {}) {\n      clientMutationId\n    }\n  }\n": types.ClearCookiesAndCacheDocument,
    "\n  mutation ClearCachedImages($input: ClearCachedImagesInput!) {\n    clearCachedImages(input: $input) {\n      cachedPages\n      cachedThumbnails\n      downloadedThumbnails\n    }\n  }\n": types.ClearCachedImagesDocument,
    "\n  query LastSync {\n    lastSyncStatus {\n      state\n      startDate\n      endDate\n      errorMessage\n    }\n  }\n": types.LastSyncDocument,
    "\n  mutation StartSync {\n    startSync(input: {}) {\n      result\n    }\n  }\n": types.StartSyncDocument,
    "\n  query KoSyncStatus {\n    koSyncStatus {\n      isLoggedIn\n      serverAddress\n      username\n    }\n  }\n": types.KoSyncStatusDocument,
    "\n  mutation ConnectKoSync($input: ConnectKoSyncAccountInput!) {\n    connectKoSyncAccount(input: $input) {\n      message\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n": types.ConnectKoSyncDocument,
    "\n  mutation LogoutKoSync {\n    logoutKoSyncAccount(input: {}) {\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n": types.LogoutKoSyncDocument,
    "\n  query Users {\n    users {\n      nodes {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n": types.UsersDocument,
    "\n  query UserCodes {\n    userCodes {\n      id\n      purpose\n      expiresAt\n      createdBy {\n        id\n        username\n      }\n      user {\n        id\n        username\n      }\n    }\n  }\n": types.UserCodesDocument,
    "\n  mutation CreateRegistrationCode {\n    createRegistrationCode(input: {}) {\n      code\n      expiresAt\n    }\n  }\n": types.CreateRegistrationCodeDocument,
    "\n  mutation CreateRecoveryCode($userId: Int!) {\n    createRecoveryCode(input: { userId: $userId }) {\n      code\n      expiresAt\n    }\n  }\n": types.CreateRecoveryCodeDocument,
    "\n  mutation RevokeUserCode($id: Int!) {\n    revokeUserCode(input: { id: $id }) {\n      clientMutationId\n    }\n  }\n": types.RevokeUserCodeDocument,
    "\n  mutation UpdateUser($input: UpdateUserInput!) {\n    updateUser(input: $input) {\n      user {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n": types.UpdateUserDocument,
    "\n  mutation RegisterUser($input: RegisterInput!) {\n    register(input: $input) {\n      clientMutationId\n    }\n  }\n": types.RegisterUserDocument,
    "\n  fragment TrackerFields on TrackerType {\n    id\n    name\n    icon\n    isLoggedIn\n    isTokenExpired\n    authUrl\n    supportsPrivateTracking\n    supportsReadingDates\n    supportsTrackDeletion\n    scores\n    statuses {\n      name\n      value\n    }\n  }\n": types.TrackerFieldsFragmentDoc,
    "\n  fragment TrackRecordFields on TrackRecordType {\n    id\n    trackerId\n    mangaId\n    remoteId\n    remoteUrl\n    title\n    status\n    lastChapterRead\n    totalChapters\n    score\n    displayScore\n    startDate\n    finishDate\n    private\n  }\n": types.TrackRecordFieldsFragmentDoc,
    "\n  fragment TrackSearchFields on TrackSearchType {\n    id\n    remoteId\n    title\n    coverUrl\n    summary\n    publishingStatus\n    publishingType\n    startDate\n    totalChapters\n    trackingUrl\n  }\n": types.TrackSearchFieldsFragmentDoc,
    "\n  query Trackers {\n    trackers {\n      nodes {\n        ...TrackerFields\n      }\n    }\n  }\n": types.TrackersDocument,
    "\n  query MangaTracks($id: Int!) {\n    manga(id: $id) {\n      id\n      trackRecords {\n        nodes {\n          ...TrackRecordFields\n        }\n      }\n    }\n  }\n": types.MangaTracksDocument,
    "\n  query SearchTracker($trackerId: Int!, $query: String!) {\n    searchTracker(input: { trackerId: $trackerId, query: $query }) {\n      trackSearches {\n        ...TrackSearchFields\n      }\n    }\n  }\n": types.SearchTrackerDocument,
    "\n  mutation BindTrack($mangaId: Int!, $trackerId: Int!, $remoteId: LongString!, $private: Boolean) {\n    bindTrack(input: { mangaId: $mangaId, trackerId: $trackerId, remoteId: $remoteId, private: $private }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n": types.BindTrackDocument,
    "\n  mutation UpdateTrack($input: UpdateTrackInput!) {\n    updateTrack(input: $input) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n": types.UpdateTrackDocument,
    "\n  mutation FetchTrack($recordId: Int!) {\n    fetchTrack(input: { recordId: $recordId }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n": types.FetchTrackDocument,
    "\n  mutation UnbindTrack($recordId: Int!, $deleteRemoteTrack: Boolean) {\n    unbindTrack(input: { recordId: $recordId, deleteRemoteTrack: $deleteRemoteTrack }) {\n      trackRecord {\n        id\n      }\n    }\n  }\n": types.UnbindTrackDocument,
    "\n  mutation TrackProgress($mangaId: Int!) {\n    trackProgress(input: { mangaId: $mangaId }) {\n      trackRecords {\n        ...TrackRecordFields\n      }\n    }\n  }\n": types.TrackProgressDocument,
    "\n  mutation LoginTrackerOAuth($trackerId: Int!, $callbackUrl: String!) {\n    loginTrackerOAuth(input: { trackerId: $trackerId, callbackUrl: $callbackUrl }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n": types.LoginTrackerOAuthDocument,
    "\n  mutation LoginTrackerCredentials($trackerId: Int!, $username: String!, $password: String!) {\n    loginTrackerCredentials(input: { trackerId: $trackerId, username: $username, password: $password }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n": types.LoginTrackerCredentialsDocument,
    "\n  mutation LogoutTracker($trackerId: Int!) {\n    logoutTracker(input: { trackerId: $trackerId }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n": types.LogoutTrackerDocument,
    "\n  query LastUpdate {\n    lastUpdateTimestamp {\n      timestamp\n    }\n  }\n": types.LastUpdateDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n"): (typeof documents)["\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CurrentUser {\n    user {\n      id\n      username\n      roles\n      permissions\n    }\n  }\n"): (typeof documents)["\n  query CurrentUser {\n    user {\n      id\n      username\n      roles\n      permissions\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RedeemRegistrationCode($input: RedeemRegistrationCodeInput!) {\n    redeemRegistrationCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n"): (typeof documents)["\n  mutation RedeemRegistrationCode($input: RedeemRegistrationCodeInput!) {\n    redeemRegistrationCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RedeemRecoveryCode($input: RedeemRecoveryCodeInput!) {\n    redeemRecoveryCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n"): (typeof documents)["\n  mutation RedeemRecoveryCode($input: RedeemRecoveryCodeInput!) {\n    redeemRecoveryCode(input: $input) {\n      accessToken\n      refreshToken\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RefreshToken($input: RefreshTokenInput!) {\n    refreshToken(input: $input) {\n      accessToken\n    }\n  }\n"): (typeof documents)["\n  mutation RefreshToken($input: RefreshTokenInput!) {\n    refreshToken(input: $input) {\n      accessToken\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateChapters($ids: [Int!]!, $patch: UpdateChapterPatchInput!) {\n    updateChapters(input: { ids: $ids, patch: $patch }) {\n      chapters {\n        id\n        isRead\n        isBookmarked\n        lastPageRead\n        manga {\n          id\n          unreadCount\n          bookmarkCount\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateChapters($ids: [Int!]!, $patch: UpdateChapterPatchInput!) {\n    updateChapters(input: { ids: $ids, patch: $patch }) {\n      chapters {\n        id\n        isRead\n        isBookmarked\n        lastPageRead\n        manga {\n          id\n          unreadCount\n          bookmarkCount\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation EnqueueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation EnqueueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteDownloads($ids: [Int!]!) {\n    deleteDownloadedChapters(input: { ids: $ids }) {\n      chapters {\n        id\n        isDownloaded\n        manga {\n          id\n          downloadCount\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteDownloads($ids: [Int!]!) {\n    deleteDownloadedChapters(input: { ids: $ids }) {\n      chapters {\n        id\n        isDownloaded\n        manga {\n          id\n          downloadCount\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment DownloadItem on DownloadType {\n    progress\n    state\n    position\n    tries\n    chapter {\n      id\n      name\n      chapterNumber\n      mangaId\n      pageCount\n    }\n    manga {\n      id\n      title\n      thumbnailUrl\n    }\n  }\n"): (typeof documents)["\n  fragment DownloadItem on DownloadType {\n    progress\n    state\n    position\n    tries\n    chapter {\n      id\n      name\n      chapterNumber\n      mangaId\n      pageCount\n    }\n    manga {\n      id\n      title\n      thumbnailUrl\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription DownloadsChanged {\n    downloadStatusChanged(input: { maxUpdates: 50 }) {\n      state\n      omittedUpdates\n      initial {\n        ...DownloadItem\n      }\n      updates {\n        type\n        download {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  subscription DownloadsChanged {\n    downloadStatusChanged(input: { maxUpdates: 50 }) {\n      state\n      omittedUpdates\n      initial {\n        ...DownloadItem\n      }\n      updates {\n        type\n        download {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DownloadsSnapshot {\n    downloadStatus {\n      state\n      queue {\n        ...DownloadItem\n      }\n    }\n  }\n"): (typeof documents)["\n  query DownloadsSnapshot {\n    downloadStatus {\n      state\n      queue {\n        ...DownloadItem\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription UpdaterChanged {\n    libraryUpdateStatusChanged(input: { maxUpdates: 1 }) {\n      omittedUpdates\n      jobsInfo {\n        isRunning\n        finishedJobs\n        totalJobs\n      }\n    }\n  }\n"): (typeof documents)["\n  subscription UpdaterChanged {\n    libraryUpdateStatusChanged(input: { maxUpdates: 1 }) {\n      omittedUpdates\n      jobsInfo {\n        isRunning\n        finishedJobs\n        totalJobs\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StartDownloader {\n    startDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation StartDownloader {\n    startDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StopDownloader {\n    stopDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation StopDownloader {\n    stopDownloader(input: {}) {\n      downloadStatus {\n        state\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AboutServer {\n    aboutServer {\n      name\n      version\n    }\n  }\n"): (typeof documents)["\n  query AboutServer {\n    aboutServer {\n      name\n      version\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Sources {\n    sources {\n      nodes {\n        id\n        name\n        displayName\n        lang\n        iconUrl\n        supportsLatest\n        contentWarning\n        homeUrl\n      }\n    }\n  }\n"): (typeof documents)["\n  query Sources {\n    sources {\n      nodes {\n        id\n        name\n        displayName\n        lang\n        iconUrl\n        supportsLatest\n        contentWarning\n        homeUrl\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FetchSourceManga($source: LongString!, $type: FetchSourceMangaType!, $page: Int!, $query: String, $filters: [FilterChangeInput!]) {\n    fetchSourceManga(input: { source: $source, type: $type, page: $page, query: $query, filters: $filters }) {\n      hasNextPage\n      mangas {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation FetchSourceManga($source: LongString!, $type: FetchSourceMangaType!, $page: Int!, $query: String, $filters: [FilterChangeInput!]) {\n    fetchSourceManga(input: { source: $source, type: $type, page: $page, query: $query, filters: $filters }) {\n      hasNextPage\n      mangas {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment SourceFilterFields on Filter {\n    __typename\n    ... on TextFilter { name textDefault: default }\n    ... on CheckBoxFilter { name checkBoxDefault: default }\n    ... on TriStateFilter { name triStateDefault: default }\n    ... on SelectFilter { name values selectDefault: default }\n    ... on SortFilter { name values sortDefault: default { index ascending } }\n    ... on HeaderFilter { name }\n    ... on SeparatorFilter { name }\n    ... on GroupFilter { name }\n  }\n"): (typeof documents)["\n  fragment SourceFilterFields on Filter {\n    __typename\n    ... on TextFilter { name textDefault: default }\n    ... on CheckBoxFilter { name checkBoxDefault: default }\n    ... on TriStateFilter { name triStateDefault: default }\n    ... on SelectFilter { name values selectDefault: default }\n    ... on SortFilter { name values sortDefault: default { index ascending } }\n    ... on HeaderFilter { name }\n    ... on SeparatorFilter { name }\n    ... on GroupFilter { name }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment SourceFilterLevel1 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterFields } }\n  }\n"): (typeof documents)["\n  fragment SourceFilterLevel1 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterFields } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment SourceFilterLevel2 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel1 } }\n  }\n"): (typeof documents)["\n  fragment SourceFilterLevel2 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel1 } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment SourceFilterLevel3 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel2 } }\n  }\n"): (typeof documents)["\n  fragment SourceFilterLevel3 on Filter {\n    ...SourceFilterFields\n    ... on GroupFilter { filters { ...SourceFilterLevel2 } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SourceFilters($id: LongString!) {\n    source(id: $id) {\n      id\n      filters {\n        ...SourceFilterFields\n        ... on GroupFilter { filters { ...SourceFilterLevel3 } }\n      }\n    }\n  }\n"): (typeof documents)["\n  query SourceFilters($id: LongString!) {\n    source(id: $id) {\n      id\n      filters {\n        ...SourceFilterFields\n        ... on GroupFilter { filters { ...SourceFilterLevel3 } }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ExtensionFields on ExtensionType {\n    pkgName\n    name\n    lang\n    versionName\n    iconUrl\n    isInstalled\n    hasUpdate\n    isObsolete\n    contentWarning\n    extensionStore {\n      indexUrl\n      name\n    }\n  }\n"): (typeof documents)["\n  fragment ExtensionFields on ExtensionType {\n    pkgName\n    name\n    lang\n    versionName\n    iconUrl\n    isInstalled\n    hasUpdate\n    isObsolete\n    contentWarning\n    extensionStore {\n      indexUrl\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Extensions {\n    extensions {\n      nodes {\n        ...ExtensionFields\n      }\n    }\n  }\n"): (typeof documents)["\n  query Extensions {\n    extensions {\n      nodes {\n        ...ExtensionFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FetchExtensions {\n    fetchExtensions(input: {}) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation FetchExtensions {\n    fetchExtensions(input: {}) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExtensionUpdateCount {\n    extensions(condition: { hasUpdate: true }) {\n      totalCount\n    }\n  }\n"): (typeof documents)["\n  query ExtensionUpdateCount {\n    extensions(condition: { hasUpdate: true }) {\n      totalCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateExtension($id: String!, $patch: UpdateExtensionPatchInput!) {\n    updateExtension(input: { id: $id, patch: $patch }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateExtension($id: String!, $patch: UpdateExtensionPatchInput!) {\n    updateExtension(input: { id: $id, patch: $patch }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateExtensions($ids: [String!]!) {\n    updateExtensions(input: { ids: $ids, patch: { update: true } }) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateExtensions($ids: [String!]!) {\n    updateExtensions(input: { ids: $ids, patch: { update: true } }) {\n      extensions {\n        ...ExtensionFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InstallExternalExtension($file: Upload!) {\n    installExternalExtension(input: { extensionFile: $file }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation InstallExternalExtension($file: Upload!) {\n    installExternalExtension(input: { extensionFile: $file }) {\n      extension {\n        ...ExtensionFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DequeueDownloads($ids: [Int!]!) {\n    dequeueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation DequeueDownloads($ids: [Int!]!) {\n    dequeueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RequeueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation RequeueDownloads($ids: [Int!]!) {\n    enqueueChapterDownloads(input: { ids: $ids }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ReorderDownload($id: Int!, $to: Int!) {\n    reorderChapterDownload(input: { chapterId: $id, to: $to }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ReorderDownload($id: Int!, $to: Int!) {\n    reorderChapterDownload(input: { chapterId: $id, to: $to }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ReorderDownloads($reorders: [ChapterDownloadReorderInput!]!) {\n    reorderChapterDownloads(input: { reorders: $reorders }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ReorderDownloads($reorders: [ChapterDownloadReorderInput!]!) {\n    reorderChapterDownloads(input: { reorders: $reorders }) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ClearDownloads {\n    clearDownloader(input: {}) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ClearDownloads {\n    clearDownloader(input: {}) {\n      downloadStatus {\n        state\n        queue {\n          ...DownloadItem\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query History($first: Int!, $offset: Int!) {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: $first, offset: $offset) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query History($first: Int!, $offset: Int!) {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: $first, offset: $offset) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation HideHistory($ids: [Int!]!, $key: String!, $value: String!) {\n    setChapterMetas(input: { items: [{ chapterIds: $ids, metas: [{ key: $key, value: $value }] }] }) {\n      metas {\n        chapterId\n        key\n        value\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation HideHistory($ids: [Int!]!, $key: String!, $value: String!) {\n    setChapterMetas(input: { items: [{ chapterIds: $ids, metas: [{ key: $key, value: $value }] }] }) {\n      metas {\n        chapterId\n        key\n        value\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecentReads {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: 150) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        # 历史里删掉的记录（features/history）首页也不显示\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          author\n          genre\n          description\n          inLibrary\n          unreadCount\n          source {\n            id\n            displayName\n          }\n          firstUnreadChapter {\n            id\n            name\n            chapterNumber\n            lastPageRead\n            pageCount\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query RecentReads {\n    chapters(filter: { lastReadAt: { greaterThan: \"0\" } }, order: [{ by: LAST_READ_AT, byType: DESC }], first: 150) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        lastPageRead\n        pageCount\n        isRead\n        lastReadAt\n        # 历史里删掉的记录（features/history）首页也不显示\n        meta {\n          key\n          value\n        }\n        manga {\n          id\n          title\n          thumbnailUrl\n          author\n          genre\n          description\n          inLibrary\n          unreadCount\n          source {\n            id\n            displayName\n          }\n          firstUnreadChapter {\n            id\n            name\n            chapterNumber\n            lastPageRead\n            pageCount\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecentUpdates($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {\n    chapters(\n      filter: $filter\n      order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]\n      first: $first\n      offset: $offset\n    ) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        fetchedAt\n        uploadDate\n        isRead\n        isDownloaded\n        isBookmarked\n        lastPageRead\n        pageCount\n        mangaId\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query RecentUpdates($first: Int!, $offset: Int!, $filter: ChapterFilterInput!) {\n    chapters(\n      filter: $filter\n      order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]\n      first: $first\n      offset: $offset\n    ) {\n      totalCount\n      pageInfo {\n        hasNextPage\n      }\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        fetchedAt\n        uploadDate\n        isRead\n        isDownloaded\n        isBookmarked\n        lastPageRead\n        pageCount\n        mangaId\n        manga {\n          id\n          title\n          thumbnailUrl\n          source {\n            id\n            displayName\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LibraryMangas {\n    mangas(condition: { inLibrary: true }) {\n      totalCount\n      nodes {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        genre\n        status\n        inLibraryAt\n        unreadCount\n        downloadCount\n        bookmarkCount\n        source {\n          id\n          displayName\n        }\n        categories {\n          nodes {\n            id\n          }\n        }\n        lastReadChapter {\n          id\n          lastReadAt\n        }\n        latestFetchedChapter {\n          id\n          fetchedAt\n        }\n        latestUploadedChapter {\n          id\n          uploadDate\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query LibraryMangas {\n    mangas(condition: { inLibrary: true }) {\n      totalCount\n      nodes {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        genre\n        status\n        inLibraryAt\n        unreadCount\n        downloadCount\n        bookmarkCount\n        source {\n          id\n          displayName\n        }\n        categories {\n          nodes {\n            id\n          }\n        }\n        lastReadChapter {\n          id\n          lastReadAt\n        }\n        latestFetchedChapter {\n          id\n          fetchedAt\n        }\n        latestUploadedChapter {\n          id\n          uploadDate\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Categories {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n      }\n    }\n  }\n"): (typeof documents)["\n  query Categories {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateLibrary($categories: [Int!]) {\n    updateLibrary(input: { categories: $categories }) {\n      updateStatus {\n        jobsInfo {\n          isRunning\n          finishedJobs\n          totalJobs\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateLibrary($categories: [Int!]) {\n    updateLibrary(input: { categories: $categories }) {\n      updateStatus {\n        jobsInfo {\n          isRunning\n          finishedJobs\n          totalJobs\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetInLibrary($ids: [Int!]!, $inLibrary: Boolean!) {\n    updateMangas(input: { ids: $ids, patch: { inLibrary: $inLibrary } }) {\n      mangas {\n        id\n        inLibrary\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SetInLibrary($ids: [Int!]!, $inLibrary: Boolean!) {\n    updateMangas(input: { ids: $ids, patch: { inLibrary: $inLibrary } }) {\n      mangas {\n        id\n        inLibrary\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetMangasCategories($ids: [Int!]!, $add: [Int!], $remove: [Int!]) {\n    updateMangasCategories(input: { ids: $ids, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      mangas {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SetMangasCategories($ids: [Int!]!, $add: [Int!], $remove: [Int!]) {\n    updateMangasCategories(input: { ids: $ids, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      mangas {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ChapterIds($filter: ChapterFilterInput!) {\n    chapters(filter: $filter) {\n      nodes {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  query ChapterIds($filter: ChapterFilterInput!) {\n    chapters(filter: $filter) {\n      nodes {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MangaDetail($id: Int!) {\n    manga(id: $id) {\n      id\n      title\n      thumbnailUrl\n      author\n      artist\n      description\n      genre\n      status\n      realUrl\n      inLibrary\n      initialized\n      unreadCount\n      downloadCount\n      bookmarkCount\n      source {\n        id\n        displayName\n        lang\n      }\n      categories {\n        nodes {\n          id\n          default\n        }\n      }\n      lastReadChapter {\n        id\n        lastReadAt\n      }\n    }\n  }\n"): (typeof documents)["\n  query MangaDetail($id: Int!) {\n    manga(id: $id) {\n      id\n      title\n      thumbnailUrl\n      author\n      artist\n      description\n      genre\n      status\n      realUrl\n      inLibrary\n      initialized\n      unreadCount\n      downloadCount\n      bookmarkCount\n      source {\n        id\n        displayName\n        lang\n      }\n      categories {\n        nodes {\n          id\n          default\n        }\n      }\n      lastReadChapter {\n        id\n        lastReadAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment MangaPeek on MangaType {\n    id\n    title\n    thumbnailUrl\n  }\n"): (typeof documents)["\n  fragment MangaPeek on MangaType {\n    id\n    title\n    thumbnailUrl\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MangaChapters($mangaId: Int!) {\n    chapters(condition: { mangaId: $mangaId }, order: [{ by: SOURCE_ORDER, byType: ASC }]) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        scanlator\n        uploadDate\n        isRead\n        isBookmarked\n        isDownloaded\n        lastPageRead\n        pageCount\n        lastReadAt\n      }\n    }\n  }\n"): (typeof documents)["\n  query MangaChapters($mangaId: Int!) {\n    chapters(condition: { mangaId: $mangaId }, order: [{ by: SOURCE_ORDER, byType: ASC }]) {\n      nodes {\n        id\n        name\n        chapterNumber\n        sourceOrder\n        scanlator\n        uploadDate\n        isRead\n        isBookmarked\n        isDownloaded\n        lastPageRead\n        pageCount\n        lastReadAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FetchMangaAndChapters($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        description\n        genre\n        status\n        initialized\n        unreadCount\n        downloadCount\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation FetchMangaAndChapters($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        artist\n        description\n        genre\n        status\n        initialized\n        unreadCount\n        downloadCount\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetMangaInLibrary($id: Int!, $inLibrary: Boolean!) {\n    updateManga(input: { id: $id, patch: { inLibrary: $inLibrary } }) {\n      manga {\n        id\n        inLibrary\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SetMangaInLibrary($id: Int!, $inLibrary: Boolean!) {\n    updateManga(input: { id: $id, patch: { inLibrary: $inLibrary } }) {\n      manga {\n        id\n        inLibrary\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetMangaCategories($id: Int!, $add: [Int!], $remove: [Int!]) {\n    updateMangaCategories(input: { id: $id, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      manga {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SetMangaCategories($id: Int!, $add: [Int!], $remove: [Int!]) {\n    updateMangaCategories(input: { id: $id, patch: { addToCategories: $add, removeFromCategories: $remove } }) {\n      manga {\n        id\n        categories {\n          nodes {\n            id\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MigrationTarget($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n        source {\n          id\n          displayName\n        }\n      }\n      chapters {\n        id\n        chapterNumber\n        isRead\n        isBookmarked\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation MigrationTarget($id: Int!) {\n    fetchMangaAndChapters(input: { id: $id, fetchManga: true, fetchChapters: true }) {\n      manga {\n        id\n        title\n        thumbnailUrl\n        author\n        inLibrary\n        source {\n          id\n          displayName\n        }\n      }\n      chapters {\n        id\n        chapterNumber\n        isRead\n        isBookmarked\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FetchChapterPages($chapterId: Int!) {\n    fetchChapterPages(input: { chapterId: $chapterId }) {\n      pages\n      chapter {\n        id\n        pageCount\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation FetchChapterPages($chapterId: Int!) {\n    fetchChapterPages(input: { chapterId: $chapterId }) {\n      pages\n      chapter {\n        id\n        pageCount\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SaveProgress($id: Int!, $lastPageRead: Int!, $isRead: Boolean) {\n    updateChapter(input: { id: $id, patch: { lastPageRead: $lastPageRead, isRead: $isRead } }) {\n      chapter {\n        id\n        lastPageRead\n        isRead\n        lastReadAt\n        manga {\n          id\n          unreadCount\n          lastReadChapter {\n            id\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SaveProgress($id: Int!, $lastPageRead: Int!, $isRead: Boolean) {\n    updateChapter(input: { id: $id, patch: { lastPageRead: $lastPageRead, isRead: $isRead } }) {\n      chapter {\n        id\n        lastPageRead\n        isRead\n        lastReadAt\n        manga {\n          id\n          unreadCount\n          lastReadChapter {\n            id\n            lastReadAt\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ReaderMangaMeta($id: Int!) {\n    manga(id: $id) {\n      id\n      meta {\n        key\n        value\n      }\n    }\n  }\n"): (typeof documents)["\n  query ReaderMangaMeta($id: Int!) {\n    manga(id: $id) {\n      id\n      meta {\n        key\n        value\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ReaderMetaOf($ids: [Int!]!) {\n    mangas(filter: { id: { in: $ids } }) {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query ReaderMetaOf($ids: [Int!]!) {\n    mangas(filter: { id: { in: $ids } }) {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ReaderMetaIndex {\n    mangas {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query ReaderMetaIndex {\n    mangas {\n      nodes {\n        id\n        meta {\n          key\n          value\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetReaderMeta($items: [SetMangaMetasItemInput!]!) {\n    setMangaMetas(input: { items: $items }) {\n      metas {\n        mangaId\n        key\n        value\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SetReaderMeta($items: [SetMangaMetasItemInput!]!) {\n    setMangaMetas(input: { items: $items }) {\n      metas {\n        mangaId\n        key\n        value\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ClearReaderMeta($ids: [Int!]!, $prefixes: [String!]!) {\n    deleteMangaMetas(input: { items: [{ mangaIds: $ids, prefixes: $prefixes }] }) {\n      metas {\n        mangaId\n        key\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ClearReaderMeta($ids: [Int!]!, $prefixes: [String!]!) {\n    deleteMangaMetas(input: { items: [{ mangaIds: $ids, prefixes: $prefixes }] }) {\n      metas {\n        mangaId\n        key\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CategoriesFull {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n        includeInUpdate\n        mangas {\n          totalCount\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query CategoriesFull {\n    categories(order: [{ by: ORDER }]) {\n      nodes {\n        id\n        name\n        order\n        default\n        includeInUpdate\n        mangas {\n          totalCount\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateCategory($name: String!) {\n    createCategory(input: { name: $name }) {\n      category {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateCategory($name: String!) {\n    createCategory(input: { name: $name }) {\n      category {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateCategory($id: Int!, $patch: UpdateCategoryPatchInput!) {\n    updateCategory(input: { id: $id, patch: $patch }) {\n      category {\n        id\n        name\n        includeInUpdate\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateCategory($id: Int!, $patch: UpdateCategoryPatchInput!) {\n    updateCategory(input: { id: $id, patch: $patch }) {\n      category {\n        id\n        name\n        includeInUpdate\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteCategory($id: Int!) {\n    deleteCategory(input: { categoryId: $id }) {\n      category {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteCategory($id: Int!) {\n    deleteCategory(input: { categoryId: $id }) {\n      category {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveCategory($id: Int!, $position: Int!) {\n    updateCategoryOrder(input: { id: $id, position: $position }) {\n      categories {\n        id\n        order\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation MoveCategory($id: Int!, $position: Int!) {\n    updateCategoryOrder(input: { id: $id, position: $position }) {\n      categories {\n        id\n        order\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ServerSettings on SettingsType {\n    # 书库更新\n    globalUpdateInterval\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    # 下载\n    downloadsPath\n    downloadAsCbz\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    downloadConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    # 来源与扩展\n    maxSourcesInParallel\n    localSourcePath\n    kcefEnabled\n    flareSolverrEnabled\n    flareSolverrUrl\n    flareSolverrTimeout\n    flareSolverrSessionName\n    flareSolverrSessionTtl\n    flareSolverrAsResponseFallback\n    # 备份\n    backupPath\n    backupTime\n    backupInterval\n    backupTTL\n    autoBackupIncludeManga\n    autoBackupIncludeCategories\n    autoBackupIncludeChapters\n    autoBackupIncludeTracking\n    autoBackupIncludeHistory\n    autoBackupIncludeClientData\n    autoBackupIncludeServerSettings\n    # 同步\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    # 服务器\n    ip\n    port\n    authMode\n    authUsername\n    jwtTokenExpiry\n    jwtRefreshExpiry\n    socksProxyEnabled\n    socksProxyVersion\n    socksProxyHost\n    socksProxyPort\n    socksProxyUsername\n    webUIFlavor\n    webUIChannel\n    webUIUpdateCheckInterval\n    initialOpenInBrowserEnabled\n    systemTrayEnabled\n    debugLogsEnabled\n    maxLogFiles\n    maxLogFileSize\n    maxLogFolderSize\n    databaseType\n    databaseUrl\n    databaseUsername\n    useHikariConnectionPool\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n"): (typeof documents)["\n  fragment ServerSettings on SettingsType {\n    # 书库更新\n    globalUpdateInterval\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    # 下载\n    downloadsPath\n    downloadAsCbz\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    downloadConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    # 来源与扩展\n    maxSourcesInParallel\n    localSourcePath\n    kcefEnabled\n    flareSolverrEnabled\n    flareSolverrUrl\n    flareSolverrTimeout\n    flareSolverrSessionName\n    flareSolverrSessionTtl\n    flareSolverrAsResponseFallback\n    # 备份\n    backupPath\n    backupTime\n    backupInterval\n    backupTTL\n    autoBackupIncludeManga\n    autoBackupIncludeCategories\n    autoBackupIncludeChapters\n    autoBackupIncludeTracking\n    autoBackupIncludeHistory\n    autoBackupIncludeClientData\n    autoBackupIncludeServerSettings\n    # 同步\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    # 服务器\n    ip\n    port\n    authMode\n    authUsername\n    jwtTokenExpiry\n    jwtRefreshExpiry\n    socksProxyEnabled\n    socksProxyVersion\n    socksProxyHost\n    socksProxyPort\n    socksProxyUsername\n    webUIFlavor\n    webUIChannel\n    webUIUpdateCheckInterval\n    initialOpenInBrowserEnabled\n    systemTrayEnabled\n    debugLogsEnabled\n    maxLogFiles\n    maxLogFileSize\n    maxLogFolderSize\n    databaseType\n    databaseUrl\n    databaseUsername\n    useHikariConnectionPool\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment UserSettings on UserSettingsType {\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n"): (typeof documents)["\n  fragment UserSettings on UserSettingsType {\n    excludeUnreadChapters\n    excludeNotStarted\n    excludeCompleted\n    updateMangas\n    autoDownloadNewChapters\n    autoDownloadNewChaptersLimit\n    excludeEntryWithUnreadChapters\n    autoDownloadIgnoreReUploads\n    serveConversions {\n      mimeType\n      target\n      compressionLevel\n    }\n    syncYomiEnabled\n    syncYomiHost\n    syncInterval\n    syncDataManga\n    syncDataChapters\n    syncDataTracking\n    syncDataHistory\n    syncDataCategories\n    koreaderSyncChecksumMethod\n    koreaderSyncPercentageTolerance\n    koreaderSyncStrategyForward\n    koreaderSyncStrategyBackward\n    opdsUseBinaryFileSizes\n    opdsItemsPerPage\n    opdsEnablePageReadProgress\n    opdsMarkAsReadOnDownload\n    opdsShowOnlyUnreadChapters\n    opdsShowOnlyDownloadedChapters\n    opdsChapterSortOrder\n    opdsCbzMimetype\n    opdsSkipChapterMetadataFeed\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MultiUserSettings {\n    settings {\n      autoBackupIncludeUserSettings\n    }\n  }\n"): (typeof documents)["\n  query MultiUserSettings {\n    settings {\n      autoBackupIncludeUserSettings\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query UserSettings {\n    userSettings {\n      ...UserSettings\n    }\n  }\n"): (typeof documents)["\n  query UserSettings {\n    userSettings {\n      ...UserSettings\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetUserSettings($settings: PartialUserSettingsTypeInput!) {\n    setUserSettings(input: { userSettings: $settings }) {\n      userSettings {\n        ...UserSettings\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SetUserSettings($settings: PartialUserSettingsTypeInput!) {\n    setUserSettings(input: { userSettings: $settings }) {\n      userSettings {\n        ...UserSettings\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ServerSettings {\n    settings {\n      ...ServerSettings\n    }\n  }\n"): (typeof documents)["\n  query ServerSettings {\n    settings {\n      ...ServerSettings\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetServerSettings($settings: PartialSettingsTypeInput!) {\n    setSettings(input: { settings: $settings }) {\n      settings {\n        ...ServerSettings\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation SetServerSettings($settings: PartialSettingsTypeInput!) {\n    setSettings(input: { settings: $settings }) {\n      settings {\n        ...ServerSettings\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SettingsAbout {\n    aboutServer {\n      name\n      version\n      buildType\n      buildTime\n      github\n      discord\n      platformInfo {\n        arch\n        os {\n          name\n          version\n        }\n        jvm {\n          javaVersion\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query SettingsAbout {\n    aboutServer {\n      name\n      version\n      buildType\n      buildTime\n      github\n      discord\n      platformInfo {\n        arch\n        os {\n          name\n          version\n        }\n        jvm {\n          javaVersion\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CheckServerUpdates {\n    checkForServerUpdates {\n      channel\n      tag\n      url\n    }\n  }\n"): (typeof documents)["\n  query CheckServerUpdates {\n    checkForServerUpdates {\n      channel\n      tag\n      url\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetPassword($input: SetPasswordInput!) {\n    setPassword(input: $input) {\n      clientMutationId\n    }\n  }\n"): (typeof documents)["\n  mutation SetPassword($input: SetPasswordInput!) {\n    setPassword(input: $input) {\n      clientMutationId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateBackup {\n    createBackup(input: {}) {\n      url\n    }\n  }\n"): (typeof documents)["\n  mutation CreateBackup {\n    createBackup(input: {}) {\n      url\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ValidateBackup($input: ValidateBackupInput!) {\n    validateBackup(input: $input) {\n      missingSources {\n        id\n        name\n      }\n      missingTrackers {\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  query ValidateBackup($input: ValidateBackupInput!) {\n    validateBackup(input: $input) {\n      missingSources {\n        id\n        name\n      }\n      missingTrackers {\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RestoreBackup($input: RestoreBackupInput!) {\n    restoreBackup(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation RestoreBackup($input: RestoreBackupInput!) {\n    restoreBackup(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RestoreStatus($id: String!) {\n    restoreStatus(id: $id) {\n      state\n      mangaProgress\n      totalManga\n    }\n  }\n"): (typeof documents)["\n  query RestoreStatus($id: String!) {\n    restoreStatus(id: $id) {\n      state\n      mangaProgress\n      totalManga\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExtensionStores {\n    extensionStores {\n      nodes {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n"): (typeof documents)["\n  query ExtensionStores {\n    extensionStores {\n      nodes {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddExtensionStore($url: String!) {\n    addExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation AddExtensionStore($url: String!) {\n    addExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n        name\n        badgeLabel\n        isLegacy\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveExtensionStore($url: String!) {\n    removeExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveExtensionStore($url: String!) {\n    removeExtensionStore(input: { indexUrl: $url }) {\n      extensionStore {\n        indexUrl\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ClearCookiesAndCache {\n    clearCookiesAndCache(input: {}) {\n      clientMutationId\n    }\n  }\n"): (typeof documents)["\n  mutation ClearCookiesAndCache {\n    clearCookiesAndCache(input: {}) {\n      clientMutationId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ClearCachedImages($input: ClearCachedImagesInput!) {\n    clearCachedImages(input: $input) {\n      cachedPages\n      cachedThumbnails\n      downloadedThumbnails\n    }\n  }\n"): (typeof documents)["\n  mutation ClearCachedImages($input: ClearCachedImagesInput!) {\n    clearCachedImages(input: $input) {\n      cachedPages\n      cachedThumbnails\n      downloadedThumbnails\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LastSync {\n    lastSyncStatus {\n      state\n      startDate\n      endDate\n      errorMessage\n    }\n  }\n"): (typeof documents)["\n  query LastSync {\n    lastSyncStatus {\n      state\n      startDate\n      endDate\n      errorMessage\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StartSync {\n    startSync(input: {}) {\n      result\n    }\n  }\n"): (typeof documents)["\n  mutation StartSync {\n    startSync(input: {}) {\n      result\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query KoSyncStatus {\n    koSyncStatus {\n      isLoggedIn\n      serverAddress\n      username\n    }\n  }\n"): (typeof documents)["\n  query KoSyncStatus {\n    koSyncStatus {\n      isLoggedIn\n      serverAddress\n      username\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ConnectKoSync($input: ConnectKoSyncAccountInput!) {\n    connectKoSyncAccount(input: $input) {\n      message\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation ConnectKoSync($input: ConnectKoSyncAccountInput!) {\n    connectKoSyncAccount(input: $input) {\n      message\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LogoutKoSync {\n    logoutKoSyncAccount(input: {}) {\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation LogoutKoSync {\n    logoutKoSyncAccount(input: {}) {\n      status {\n        isLoggedIn\n        serverAddress\n        username\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Users {\n    users {\n      nodes {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n"): (typeof documents)["\n  query Users {\n    users {\n      nodes {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query UserCodes {\n    userCodes {\n      id\n      purpose\n      expiresAt\n      createdBy {\n        id\n        username\n      }\n      user {\n        id\n        username\n      }\n    }\n  }\n"): (typeof documents)["\n  query UserCodes {\n    userCodes {\n      id\n      purpose\n      expiresAt\n      createdBy {\n        id\n        username\n      }\n      user {\n        id\n        username\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateRegistrationCode {\n    createRegistrationCode(input: {}) {\n      code\n      expiresAt\n    }\n  }\n"): (typeof documents)["\n  mutation CreateRegistrationCode {\n    createRegistrationCode(input: {}) {\n      code\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateRecoveryCode($userId: Int!) {\n    createRecoveryCode(input: { userId: $userId }) {\n      code\n      expiresAt\n    }\n  }\n"): (typeof documents)["\n  mutation CreateRecoveryCode($userId: Int!) {\n    createRecoveryCode(input: { userId: $userId }) {\n      code\n      expiresAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RevokeUserCode($id: Int!) {\n    revokeUserCode(input: { id: $id }) {\n      clientMutationId\n    }\n  }\n"): (typeof documents)["\n  mutation RevokeUserCode($id: Int!) {\n    revokeUserCode(input: { id: $id }) {\n      clientMutationId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateUser($input: UpdateUserInput!) {\n    updateUser(input: $input) {\n      user {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateUser($input: UpdateUserInput!) {\n    updateUser(input: $input) {\n      user {\n        id\n        username\n        roles\n        permissions\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RegisterUser($input: RegisterInput!) {\n    register(input: $input) {\n      clientMutationId\n    }\n  }\n"): (typeof documents)["\n  mutation RegisterUser($input: RegisterInput!) {\n    register(input: $input) {\n      clientMutationId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TrackerFields on TrackerType {\n    id\n    name\n    icon\n    isLoggedIn\n    isTokenExpired\n    authUrl\n    supportsPrivateTracking\n    supportsReadingDates\n    supportsTrackDeletion\n    scores\n    statuses {\n      name\n      value\n    }\n  }\n"): (typeof documents)["\n  fragment TrackerFields on TrackerType {\n    id\n    name\n    icon\n    isLoggedIn\n    isTokenExpired\n    authUrl\n    supportsPrivateTracking\n    supportsReadingDates\n    supportsTrackDeletion\n    scores\n    statuses {\n      name\n      value\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TrackRecordFields on TrackRecordType {\n    id\n    trackerId\n    mangaId\n    remoteId\n    remoteUrl\n    title\n    status\n    lastChapterRead\n    totalChapters\n    score\n    displayScore\n    startDate\n    finishDate\n    private\n  }\n"): (typeof documents)["\n  fragment TrackRecordFields on TrackRecordType {\n    id\n    trackerId\n    mangaId\n    remoteId\n    remoteUrl\n    title\n    status\n    lastChapterRead\n    totalChapters\n    score\n    displayScore\n    startDate\n    finishDate\n    private\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment TrackSearchFields on TrackSearchType {\n    id\n    remoteId\n    title\n    coverUrl\n    summary\n    publishingStatus\n    publishingType\n    startDate\n    totalChapters\n    trackingUrl\n  }\n"): (typeof documents)["\n  fragment TrackSearchFields on TrackSearchType {\n    id\n    remoteId\n    title\n    coverUrl\n    summary\n    publishingStatus\n    publishingType\n    startDate\n    totalChapters\n    trackingUrl\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Trackers {\n    trackers {\n      nodes {\n        ...TrackerFields\n      }\n    }\n  }\n"): (typeof documents)["\n  query Trackers {\n    trackers {\n      nodes {\n        ...TrackerFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MangaTracks($id: Int!) {\n    manga(id: $id) {\n      id\n      trackRecords {\n        nodes {\n          ...TrackRecordFields\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query MangaTracks($id: Int!) {\n    manga(id: $id) {\n      id\n      trackRecords {\n        nodes {\n          ...TrackRecordFields\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SearchTracker($trackerId: Int!, $query: String!) {\n    searchTracker(input: { trackerId: $trackerId, query: $query }) {\n      trackSearches {\n        ...TrackSearchFields\n      }\n    }\n  }\n"): (typeof documents)["\n  query SearchTracker($trackerId: Int!, $query: String!) {\n    searchTracker(input: { trackerId: $trackerId, query: $query }) {\n      trackSearches {\n        ...TrackSearchFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation BindTrack($mangaId: Int!, $trackerId: Int!, $remoteId: LongString!, $private: Boolean) {\n    bindTrack(input: { mangaId: $mangaId, trackerId: $trackerId, remoteId: $remoteId, private: $private }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation BindTrack($mangaId: Int!, $trackerId: Int!, $remoteId: LongString!, $private: Boolean) {\n    bindTrack(input: { mangaId: $mangaId, trackerId: $trackerId, remoteId: $remoteId, private: $private }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateTrack($input: UpdateTrackInput!) {\n    updateTrack(input: $input) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateTrack($input: UpdateTrackInput!) {\n    updateTrack(input: $input) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation FetchTrack($recordId: Int!) {\n    fetchTrack(input: { recordId: $recordId }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation FetchTrack($recordId: Int!) {\n    fetchTrack(input: { recordId: $recordId }) {\n      trackRecord {\n        ...TrackRecordFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UnbindTrack($recordId: Int!, $deleteRemoteTrack: Boolean) {\n    unbindTrack(input: { recordId: $recordId, deleteRemoteTrack: $deleteRemoteTrack }) {\n      trackRecord {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UnbindTrack($recordId: Int!, $deleteRemoteTrack: Boolean) {\n    unbindTrack(input: { recordId: $recordId, deleteRemoteTrack: $deleteRemoteTrack }) {\n      trackRecord {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation TrackProgress($mangaId: Int!) {\n    trackProgress(input: { mangaId: $mangaId }) {\n      trackRecords {\n        ...TrackRecordFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation TrackProgress($mangaId: Int!) {\n    trackProgress(input: { mangaId: $mangaId }) {\n      trackRecords {\n        ...TrackRecordFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LoginTrackerOAuth($trackerId: Int!, $callbackUrl: String!) {\n    loginTrackerOAuth(input: { trackerId: $trackerId, callbackUrl: $callbackUrl }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation LoginTrackerOAuth($trackerId: Int!, $callbackUrl: String!) {\n    loginTrackerOAuth(input: { trackerId: $trackerId, callbackUrl: $callbackUrl }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LoginTrackerCredentials($trackerId: Int!, $username: String!, $password: String!) {\n    loginTrackerCredentials(input: { trackerId: $trackerId, username: $username, password: $password }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation LoginTrackerCredentials($trackerId: Int!, $username: String!, $password: String!) {\n    loginTrackerCredentials(input: { trackerId: $trackerId, username: $username, password: $password }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LogoutTracker($trackerId: Int!) {\n    logoutTracker(input: { trackerId: $trackerId }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation LogoutTracker($trackerId: Int!) {\n    logoutTracker(input: { trackerId: $trackerId }) {\n      isLoggedIn\n      tracker {\n        ...TrackerFields\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LastUpdate {\n    lastUpdateTimestamp {\n      timestamp\n    }\n  }\n"): (typeof documents)["\n  query LastUpdate {\n    lastUpdateTimestamp {\n      timestamp\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;