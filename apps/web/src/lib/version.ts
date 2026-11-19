export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_NUMBER: string = __BUILD_NUMBER__;
export const GIT_SHA: string = __GIT_SHA__;
export const BUILD_DATE: string = __BUILD_DATE__;

/** "1.0.0 (build 42 · abc1234)" */
export const VERSION_LABEL = `${APP_VERSION} (build ${BUILD_NUMBER} · ${GIT_SHA})`;
