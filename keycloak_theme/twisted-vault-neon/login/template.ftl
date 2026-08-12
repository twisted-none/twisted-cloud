<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}">

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${msg("loginTitle",(realm.displayName!""))}</title>
    
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>

    <!-- СКРИПТ УПРАВЛЕНИЯ ТЕМОЙ (СИНХРОНИЗАЦИЯ ЧЕРЕЗ COOKIE) -->
    <script>
        (function() {
            // Функция для чтения куки по имени
            function getCookie(name) {
                const value = `; ` + document.cookie;
                const parts = value.split(`; ` + name + `=`);
                if (parts.length === 2) return parts.pop().split(';').shift();
                return null;
            }

            // 1. Пробуем URL (самый высокий приоритет)
            const params = new URLSearchParams(window.location.search);
            const urlTheme = params.get('theme');
            
            // 2. Пробуем Cookie (средний приоритет - общий между доменами)
            const cookieTheme = getCookie('kc-theme');

            // 3. Пробуем LocalStorage (низкий приоритет - только для этого домена)
            const localTheme = localStorage.getItem('kc-theme');
            
            // Логика выбора
            let theme = 'light'; // Дефолт

            if (urlTheme === 'light' || urlTheme === 'dark') {
                theme = urlTheme;
            } else if (cookieTheme === 'light' || cookieTheme === 'dark') {
                theme = cookieTheme;
            } else if (localTheme === 'light' || localTheme === 'dark') {
                theme = localTheme;
            }

            // Сохраняем в локальное хранилище и обновляем куку для синхронности
            localStorage.setItem('kc-theme', theme);
            // Обновляем куку, чтобы продлить ей жизнь
            // Примечание: тут мы не знаем родительский домен точно, поэтому ставим на текущий, 
            // но чтение выше сработает и с родительской кукой.
            
            // 4. Применяем класс
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        })();
    </script>
</head>

<body>
    <#nested "form">
</body>
</html>
</#macro>