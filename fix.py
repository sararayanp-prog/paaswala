import pathlib
p = pathlib.Path("public/index.html")
t = p.read_text()
if 'function closePopup' not in t:
    t = t.replace('downloadPopup">', 'downloadPopup"><button onclick="closePopup()" style="position:absolute;top:8px;right:12px;background:none;border:none;font-size:22px;">✖️</button>', 1)
if 'Baad Me' not in t:
    t = t.replace('ABHI DOWNLOAD KARO</button>', 'ABHI DOWNLOAD KARO</button><button onclick="closePopup()" style="background:white;color:#555;font-size:16px;padding:12px;width:100%;border:1px solid #ccc;border-radius:12px;margin-top:10px;">Baad Me</button>')
if 'function closePopup' not in t:
    t = t.replace('</body>', '<script>function closePopup(){document.getElementById("downloadPopup").style.display="none";} async function downloadApp(){try{await fetch("/api/download",{method:"POST"});}catch(e){} alert("Ab upar 3 dot dabao - Add to Home Screen dabao"); closePopup();}</script></body>')
p.write_text(t)
print("HO GAYA")
