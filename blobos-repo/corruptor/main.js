(() => {
    function corruptTextNodes() {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const glitchChars = ['▓', '░', '▒', '█', '╳', '?', '!', '0', '1', 'Ɇ', 'Ø', '∆'];
        let node;

        while ((node = walker.nextNode())) {
            
            if (['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName) || !node.nodeValue.trim()) continue;

            
            if (Math.random() < 0.15) {
                const chars = node.nodeValue.split('');
                for (let i = 0; i < chars.length; i++) {
                    if (Math.random() < 0.3 && chars[i] !== ' ') {
                        chars[i] = glitchChars[Math.floor(Math.random() * glitchChars.length)];
                    }
                }
                node.nodeValue = chars.join('');
            }
        }
    }

    
    function corruptStyles() {
        const allElements = document.querySelectorAll('div, span, img, button, li, p, h1, h2, h3');
        if (!allElements.length) return;

        
        for (let i = 0; i < 5; i++) {
            const el = allElements[Math.floor(Math.random() * allElements.length)];
            const effect = Math.floor(Math.random() * 5);

            switch (effect) {
                case 0: 
                    el.style.transform = `skew(${(Math.random() - 0.5) * 40}deg) rotate(${(Math.random() - 0.5) * 20}deg)`;
                    break;
                case 1: 
                    el.style.filter = `invert(${Math.random() > 0.5 ? 1 : 0}) hue-rotate(${Math.random() * 360}deg) contrast(200%)`;
                    break;
                case 2: 
                    el.style.position = 'relative';
                    el.style.left = `${(Math.random() - 0.5) * 30}px`;
                    el.style.top = `${(Math.random() - 0.5) * 30}px`;
                    break;
                case 3: 
                    if (el.tagName === 'IMG') {
                        el.style.objectFit = 'none';
                        el.style.transform = `scale(${Math.random() * 3})`;
                    }
                    break;
                case 4: 
                    el.style.outline = `${Math.floor(Math.random() * 4)}px dashed #ff0055`;
                    break;
            }
        }
    }

    

    console.warn('⚠️ BlobOS DOM Corruptor Active. Refresh page to restore.');
    const corruptionInterval = setInterval(() => {
        corruptTextNodes();
        corruptStyles();
    }, 800);

    window.stopCorruption = () => {
        clearInterval(corruptionInterval);
        console.log('Corruption halted (DOM remains damaged until refresh).');
    };
})();
