<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "form">
        
        <button id="theme-toggle" class="theme-toggle-btn" title="Toggle Theme" type="button">
            <svg id="icon-sun" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg id="icon-moon" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>

        <div class="login-card">
            
            <div class="header-wrapper">
                <h1 class="title">TWISTED VAULT</h1>
                <p class="subtitle">${(message.summary)!'Уведомление'}</p>
            </div>

            <div class="instruction-text">
                <#if message.summary == "You are logged out">
                    <p>Сеанс успешно завершен. До встречи!</p>
                <#else>
                     <p>${(message.summary)!''}</p>
                </#if>
                
                <#if skipLink??>
                <#else>
                    <#if pageRedirectUri?has_content>
                        <p><a href="${pageRedirectUri}" class="link">Нажмите здесь, если перенаправление не сработало</a></p>
                    <#elseif actionUri?has_content>
                        <p><a href="${actionUri}" class="link">Нажмите здесь для продолжения</a></p>
                    <#elseif (client.baseUrl)?has_content>
                        <p><a href="${client.baseUrl}" class="link">Вернуться к приложению</a></p>
                    </#if>
                </#if>
            </div>

             <#if pageRedirectUri?has_content>
                <div class="form-group" style="margin-top: 2rem;">
                    <a href="${pageRedirectUri}" class="btn-primary" style="text-decoration: none;">Вернуться</a>
                </div>
            <#elseif actionUri?has_content>
                <div class="form-group" style="margin-top: 2rem;">
                    <a href="${actionUri}" class="btn-primary" style="text-decoration: none;">Продолжить</a>
                </div>
            <#else>
                <div class="form-group" style="margin-top: 2rem;">
                    <a href="${url.loginUrl}" class="btn-primary" style="text-decoration: none;">Войти снова</a>
                </div>
            </#if>

        </div>

        <script>
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
                btn.addEventListener('click', function() {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('kc-theme', 'light'); } 
                    else { document.documentElement.classList.add('dark'); localStorage.setItem('kc-theme', 'dark'); }
                    updateIcon();
                });
            });
        </script>
    </#if>
</@layout.registrationLayout>
