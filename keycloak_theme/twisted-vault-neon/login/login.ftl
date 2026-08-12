<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=social.displayInfo displayMessage=!messagesPerField.existsError('username','password'); section>
    <#if section = "form">
        
        <!-- Кнопка переключения темы -->
        <button id="theme-toggle" class="theme-toggle-btn" title="Toggle Theme" type="button">
            <!-- Sun Icon (for dark mode) -->
            <svg id="icon-sun" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <!-- Moon Icon (for light mode) -->
            <svg id="icon-moon" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>

        <div class="login-card">
            <div class="header-wrapper">
                <h1 class="title">TWISTED VAULT</h1> 
                <p class="subtitle">Личное хранилище заметок</p>
            </div>

            <#if messagesPerField.existsError('username','password') || message?has_content && (message.type != 'warning' && message.type != 'info')>
                <div class="alert-error">
                    <p class="alert-error-text">
                        <#if message?has_content>${message.summary}<#else>Неверный логин или пароль</#if>
                    </p>
                </div>
            </#if>

            <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                <div class="form-group">
                    <label for="username" class="form-label">
                        <#if !realm.loginWithEmailAllowed>Имя пользователя<#elseif !realm.registrationEmailAsUsername>Имя пользователя или Email<#else>Email</#if>
                    </label>
                    <input tabindex="1" id="username" class="form-control" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="off" placeholder="Введите логин" />
                </div>

                <div class="form-group">
                    <label for="password" class="form-label">Пароль</label>
                    <div class="input-wrapper">
                        <input tabindex="2" id="password" class="form-control" name="password" type="password" autocomplete="off" placeholder="Введите пароль" style="padding-right: 2.5rem;" />
                        <button type="button" class="password-toggle" onclick="togglePassword()">
                            <svg id="icon-eye" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg id="icon-eye-off" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.8 0 1.6-.06 2.37-.18"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                        </button>
                    </div>
                </div>

                <button tabindex="4" class="btn-primary" name="login" id="kc-login" type="submit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                    ВОЙТИ
                </button>
            </form>

            <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
                <div class="footer-links">
                    <p>Нет аккаунта? <a tabindex="6" href="${url.registrationUrl}" class="link">Создать сейчас</a></p>
                </div>
            </#if>
        </div>

        <script>
            // Видимость пароля
            function togglePassword() {
                var x = document.getElementById("password");
                var eye = document.getElementById("icon-eye");
                var eyeOff = document.getElementById("icon-eye-off");
                if (x.type === "password") { x.type = "text"; eye.style.display = "none"; eyeOff.style.display = "block"; } 
                else { x.type = "password"; eye.style.display = "block"; eyeOff.style.display = "none"; }
            }

            // Переключение темы
            document.addEventListener('DOMContentLoaded', function() {
                const btn = document.getElementById('theme-toggle');
                const sun = document.getElementById('icon-sun');
                const moon = document.getElementById('icon-moon');
                
                function updateIcon() {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) { sun.style.display = 'block'; moon.style.display = 'none'; } 
                    else { sun.style.display = 'none'; moon.style.display = 'block'; }
                }
                updateIcon();

                // Функция установки куки (для кросс-доменности пытаемся ставить на родительский)
                function setCookie(name, value) {
                    const hostname = window.location.hostname;
                    const parts = hostname.split('.');
                    let domainString = hostname;
                    if (parts.length > 2 && !/^\d+$/.test(parts[parts.length - 1])) {
                       domainString = '.' + parts.slice(1).join('.');
                    }
                    document.cookie = name + "=" + value + "; domain=" + domainString + "; path=/; max-age=31536000; SameSite=Lax";
                }

                btn.addEventListener('click', function() {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) {
                        document.documentElement.classList.remove('dark');
                        localStorage.setItem('kc-theme', 'light');
                        setCookie('kc-theme', 'light');
                    } else {
                        document.documentElement.classList.add('dark');
                        localStorage.setItem('kc-theme', 'dark');
                        setCookie('kc-theme', 'dark');
                    }
                    updateIcon();
                });
            });
        </script>
    </#if>
</@layout.registrationLayout>
