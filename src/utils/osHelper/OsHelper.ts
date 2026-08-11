class OsHelper {
  isWindows(): boolean {
    return process.platform === 'win32';
  }

  isLinux(): boolean {
    return process.platform === 'linux';
  }

  isMac(): boolean {
    return process.platform === 'darwin';
  }

  isWSL(): boolean {
    return Boolean(process.env.WSL_DISTRO_NAME);
  }
}

export const osHelper = new OsHelper();
