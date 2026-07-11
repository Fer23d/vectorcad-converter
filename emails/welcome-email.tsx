import { Body, Head, Html, Preview } from "@react-email/components";

function safeName(name: string) {
  return name?.trim() || "Usuario VectorCAD";
}

export function WelcomeEmail({ name, dashboardUrl }: { name: string; dashboardUrl: string }) {
  const displayName = safeName(name);

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Sua &aacute;rea de projetos VectorCAD est&aacute; pronta.</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: "#050807", color: "#eef5f1", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0} style={{ width: "100%", margin: 0, padding: 0, backgroundColor: "#050807" }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "36px 16px" }}>
                <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0} style={{ width: "100%", maxWidth: "640px", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "0 0 18px 0" }}>
                        <table role="presentation" cellSpacing="0" cellPadding="0" border={0} style={{ borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              <td align="center" valign="middle" style={{ width: "48px", height: "48px", borderRadius: "16px", backgroundColor: "#b7f34a", color: "#09120d", fontSize: "15px", fontWeight: 900, lineHeight: "48px", textAlign: "center" }}>VC</td>
                              <td style={{ paddingLeft: "14px" }}>
                                <div style={{ color: "#f2f8f4", fontSize: "16px", fontWeight: 900, letterSpacing: "3px", lineHeight: "20px" }}>VECTORCAD</div>
                                <div style={{ color: "#91a098", fontSize: "12px", lineHeight: "18px" }}>Workspace inteligente para projetos t&eacute;cnicos</div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #26312c", borderRadius: "28px", backgroundColor: "#101613", padding: "34px", boxShadow: "0 24px 80px rgba(0,0,0,.38)" }}>
                        <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0} style={{ borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: "0 0 12px 0", color: "#b7f34a", fontSize: "11px", fontWeight: 900, letterSpacing: "2.4px", lineHeight: "16px", textTransform: "uppercase" }}>Conta criada</td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 18px 0", color: "#edf5f0", fontSize: "30px", fontWeight: 900, lineHeight: "36px" }}>Bem-vindo ao VectorCAD</td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 16px 0", color: "#a6b4ad", fontSize: "15px", lineHeight: "26px" }}>Ol&aacute;, {displayName}!</td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 16px 0", color: "#a6b4ad", fontSize: "15px", lineHeight: "26px" }}>Seja bem-vindo ao VectorCAD.</td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 22px 0", color: "#a6b4ad", fontSize: "15px", lineHeight: "26px" }}>
                                Sua conta foi criada com sucesso e agora voc&ecirc; tem acesso a uma plataforma desenvolvida para facilitar an&aacute;lises, organiza&ccedil;&atilde;o e gerenciamento de projetos de engenharia.
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 22px 0" }}>
                                <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0} style={{ borderCollapse: "collapse", backgroundColor: "#0b100e", border: "1px solid #2d3933", borderRadius: "18px" }}>
                                  <tbody>
                                    {[
                                      "Analisar arquivos CAD de forma inteligente",
                                      "Identificar informações técnicas do projeto",
                                      "Gerar relatórios organizados",
                                      "Centralizar seus projetos em um único workspace",
                                    ].map((item) => (
                                      <tr key={item}>
                                        <td style={{ padding: "10px 16px", color: "#b7f34a", fontSize: "16px", lineHeight: "22px", width: "26px" }}>✓</td>
                                        <td style={{ padding: "10px 16px 10px 0", color: "#dce6e0", fontSize: "14px", lineHeight: "22px" }}>{item}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 8px 0", color: "#edf5f0", fontSize: "17px", fontWeight: 900, lineHeight: "24px" }}>Seu pr&oacute;ximo passo:</td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 24px 0", color: "#a6b4ad", fontSize: "15px", lineHeight: "26px" }}>Acesse sua conta e envie seu primeiro projeto.</td>
                            </tr>
                            <tr>
                              <td style={{ padding: "0 0 26px 0" }}>
                                <a href={dashboardUrl} style={{ display: "inline-block", backgroundColor: "#b7f34a", color: "#09120d", borderRadius: "14px", padding: "15px 24px", fontSize: "14px", fontWeight: 900, lineHeight: "18px", textDecoration: "none" }}>Acessar meu workspace</a>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "18px", border: "1px solid #2d3933", borderRadius: "18px", backgroundColor: "#0b100e", color: "#93a29a", fontSize: "13px", lineHeight: "22px" }}>
                                Estamos construindo uma nova forma de trabalhar com projetos t&eacute;cnicos, unindo engenharia, automa&ccedil;&atilde;o e intelig&ecirc;ncia.
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "28px 0 0 0", color: "#a6b4ad", fontSize: "15px", lineHeight: "26px" }}>Atenciosamente,<br /><strong style={{ color: "#edf5f0" }}>Equipe VectorCAD</strong></td>
                            </tr>
                            <tr>
                              <td style={{ padding: "26px 0 0 0" }}>
                                <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0} style={{ borderCollapse: "collapse", borderTop: "1px solid #26312c" }}>
                                  <tbody>
                                    <tr>
                                      <td style={{ paddingTop: "20px", color: "#7e8c85", fontSize: "12px", lineHeight: "20px" }}>
                                        <strong style={{ color: "#edf5f0", letterSpacing: "1.4px", textTransform: "uppercase" }}>ASS Grupo ShiftCore</strong><br />
                                        © 2026 VectorCAD. Todos os direitos reservados.
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
