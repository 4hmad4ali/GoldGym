; Compile with Inno Setup 6. The application itself is built by build_windows.ps1.
#define AppName "Golden Gym"
#define AppVersion "4.0.0"
#define AppPublisher "Golden Gym"
#define AppExeName "Golden Gym.exe"

[Setup]
AppId={{A48F5D4A-6F64-4B83-9E07-669ED7288BB7}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\release
OutputBaseFilename=GoldenGym-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName={#AppName}

[Files]
Source: "..\dist\Golden Gym\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
begin
  if not IsWin64 then begin
    MsgBox('Golden Gym requires 64-bit Windows.', mbError, MB_OK);
    Result := False;
  end else begin
    Result := True;
  end;
end;
