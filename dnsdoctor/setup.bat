@echo off
setlocal

set "PRIMARY_DNS=45.90.28.45"
set "SECONDARY_DNS=45.90.30.45"
set "DOH_URL=https://dns.nextdns.io/1294c5"

for /f "tokens=2 delims==" %%A in ('wmic nic where "NetEnabled=true" get NetConnectionID /value ^| find "="') do (
    echo Configuring adapter: %%A

    netsh interface ip set dns name="%%A" static %PRIMARY_DNS%
    netsh interface ip add dns name="%%A" %SECONDARY_DNS% index=2

    netsh dns add encryption server=%PRIMARY_DNS% dohtemplate=%DOH_URL% autoupgrade=yes udpfallback=no
    netsh dns add encryption server=%SECONDARY_DNS% dohtemplate=%DOH_URL% autoupgrade=yes udpfallback=no

    netsh interface ip set dnsservers "%%A" static %PRIMARY_DNS% primary
    netsh interface ip add dnsservers "%%A" %SECONDARY_DNS% index=2
)

ipconfig /flushdns

echo.
echo DNS configuration applied.
pause
