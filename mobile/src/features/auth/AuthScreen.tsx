import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand, NeonButton } from '../../components/Neon';
import { request } from '../../services/auth';
import { saveToken } from '../../services/session';
function FieldIcon({ kind }: { kind: 'mail' | 'lock' | 'eye' }) {
 return <View accessible={false} style={login.icon}>
 {kind === 'mail' ? <View style={login.envelope}><View style={login.envelopeFlap}/></View> : kind === 'lock' ? <><View style={login.shackle}/><View style={login.lockBody}><View style={login.keyhole}/></View></> : <View style={login.eye}><View style={login.pupil}/></View>}
 </View>;
}
export default function AuthScreen({ register = false }: { register?: boolean }) {
 const {height} = useWindowDimensions();
 const insets = useSafeAreaInsets();
 const heroHeight = Math.max(205, Math.min(height * .36, 340));
 const [username,setUsername]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState('');
 const [visible,setVisible]=useState(false); const [checked,setChecked]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 async function submit() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage('Introduce un correo válido.');
  if (!password || (register && (username.trim().length<2 || password.length<8 || password.length>72))) return setMessage('Nombre: 2–60 caracteres. Contraseña: 8–72 caracteres.');
  if (register && password!==confirm) return setMessage('Las contraseñas no coinciden.');
  if (register && !checked) return setMessage('Debes aceptar los términos y la política de privacidad.');
  setBusy(true);setMessage('');
  try {
   if (register) { await request('register',{username:username.trim(),email:email.trim(),password,acceptedTerms:checked});setMessage('Cuenta creada. Ya puedes iniciar sesión.'); }
   else { const result=await request<{accessToken:string}>('login',{email:email.trim(),password});await saveToken(result.accessToken,checked);router.replace('/inicio'); }
  } catch(e) {setMessage((e as Error).message);} finally {setBusy(false);}
 }
 if (!register) return <SafeAreaView edges={['bottom']} style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={login.content}>
 <View style={login.canvas}>
 <View style={[login.hero,{height:heroHeight}]}>
 <Image source={require('../../../assets/sonic-login-portrait.png')} style={{position:'absolute',top:0,left:0,width:'100%',height:heroHeight*1.55}} resizeMode="cover" accessibilityLabel="Mujer con audífonos futuristas, iluminada en violeta, rosa y azul"/>
 <LinearGradient pointerEvents="none" colors={['#08051100','#08051116','#080511']} locations={[0,.50,1]} style={StyleSheet.absoluteFill}/>
 <Pressable accessibilityRole="button" accessibilityLabel="Volver a la bienvenida" hitSlop={8} onPress={()=>router.replace('/welcome')} style={[login.back,{top:Math.max(insets.top,10)+8}]}><View style={login.chevron}/></Pressable>
 </View>
 <View style={[login.form,{paddingHorizontal:Math.max(20,insets.left,insets.right)}]}>
 <View style={login.brand}><View style={login.brandRow}><LinearGradient colors={['#8b2bed','#d729c9']} style={login.brandMark}>{[11,21,28,18,9].map((bar,i)=><View key={i} style={{width:2,height:bar,borderRadius:2,backgroundColor:'#fff'}}/>)}</LinearGradient><Text style={login.brandName}>sonic<Text style={{fontWeight:'300'}}>ledger</Text><Text style={{color:'#e476ea'}}>.</Text></Text></View></View><Text style={login.title}>Iniciar sesión</Text><Text style={login.subtitle}>Accede a tu universo musical</Text>
 <View style={login.field}><FieldIcon kind="mail"/><TextInput style={login.input} placeholder="Correo electrónico" accessibilityLabel="Correo electrónico" placeholderTextColor="#bcaccb" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} editable={!busy} returnKeyType="next"/></View>
 <View style={login.field}><FieldIcon kind="lock"/><TextInput style={login.input} placeholder="Contraseña" accessibilityLabel="Contraseña" placeholderTextColor="#bcaccb" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} maxLength={72} autoComplete="current-password" editable={!busy} returnKeyType="go" onSubmitEditing={()=>{if(!busy)void submit();}}/><Pressable accessibilityRole="button" accessibilityLabel={visible?'Ocultar contraseña':'Mostrar contraseña'} accessibilityState={{expanded:visible}} onPress={()=>setVisible(!visible)} style={login.eyeButton}><FieldIcon kind="eye"/></Pressable></View>
 <View style={login.options}><Pressable accessibilityRole="checkbox" accessibilityLabel="Recordarme" accessibilityState={{checked}} onPress={()=>setChecked(!checked)} style={login.remember}><View style={[login.checkbox,checked && login.checked]}>{checked && <Text style={login.tick}>✓</Text>}</View><Text style={login.rememberText}>Recordarme</Text></Pressable><Pressable accessibilityRole="link" onPress={()=>router.push('/recuperar-contrasena')} style={login.forgot}><Text style={login.forgotText}>¿Olvidaste tu contraseña?</Text></Pressable></View>
 {message ? <Text accessibilityLiveRegion="polite" style={login.message}>{message}</Text> : null}
 <Pressable accessibilityRole="button" accessibilityLabel="Iniciar sesión" accessibilityState={{busy,disabled:busy}} disabled={busy} onPress={()=>{void submit();}} style={({pressed})=>[login.submit,{opacity:busy ? .55 : pressed ? .8 : 1}]}><LinearGradient pointerEvents="none" colors={['#8026f5','#bd25dc','#f12bb9']} start={{x:0,y:.5}} end={{x:1,y:.5}} style={StyleSheet.absoluteFill}/><Text style={login.submitText}>{busy?'Conectando…':'Iniciar sesión'}</Text>{!busy && <Text style={login.arrow}>→</Text>}</Pressable>
 <Pressable accessibilityRole="link" style={login.switch} onPress={()=>router.replace('/registro')}><Text style={login.switchText}>¿Aún no tienes una cuenta?  <Text style={login.switchLink}>Crear cuenta</Text></Text></Pressable>
 </View></View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
 <LinearGradient colors={['#250a38','#080511','#10071d']} style={StyleSheet.absoluteFill}/>
 <Pressable accessibilityRole="button" accessibilityLabel="Volver a la bienvenida" onPress={()=>router.replace('/welcome')} style={s.back}><Text style={s.text}>‹</Text></Pressable>
 {register && <View style={s.wave}/>}
 <View style={s.brand}><Brand/></View><Text style={s.title}>{register?'Crear cuenta':'Iniciar sesión'}</Text><Text style={s.subtitle}>{register?'Únete a Sonic Ledger y vive la música sin límites.':'Accede a tu universo musical'}</Text>
 {register && <TextInput style={s.input} placeholder="Nombre de usuario" accessibilityLabel="Nombre de usuario" placeholderTextColor="#bcaaca" value={username} onChangeText={setUsername} maxLength={60} autoComplete="username"/>}
 <TextInput style={s.input} placeholder="Correo electrónico" accessibilityLabel="Correo electrónico" placeholderTextColor="#bcaaca" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254}/>
 <View style={s.password}><TextInput style={[s.input,{flex:1,marginBottom:0,borderWidth:0}]} placeholder="Contraseña" accessibilityLabel="Contraseña" placeholderTextColor="#bcaaca" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" maxLength={72} autoComplete={register?'new-password':'current-password'}/><Pressable accessibilityRole="button" accessibilityLabel={visible?'Ocultar contraseña':'Mostrar contraseña'} onPress={()=>setVisible(!visible)} style={s.show}><Text style={s.link}>{visible?'Ocultar':'Ver'}</Text></Pressable></View>
 {register && <TextInput style={s.input} placeholder="Confirmar contraseña" accessibilityLabel="Confirmar contraseña" placeholderTextColor="#bcaaca" value={confirm} onChangeText={setConfirm} secureTextEntry={!visible} autoCapitalize="none" autoComplete="new-password"/>}
 <Pressable accessibilityRole="checkbox" accessibilityState={{checked}} onPress={()=>setChecked(!checked)} style={s.check}><Text style={s.box}>{checked?'☑':'□'}</Text><Text style={[s.text,{flex:1,fontSize:12}]}>{register?'Acepto los Términos y Condiciones y la Política de Privacidad':'Recordarme'}</Text></Pressable>
 {!register && <Pressable accessibilityRole="link" onPress={()=>router.push('/recuperar-contrasena')} style={{alignSelf:'flex-end',paddingVertical:12}}><Text style={[s.link,{fontSize:12}]}>¿Olvidaste tu contraseña?</Text></Pressable>}
 <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text><NeonButton disabled={busy} onPress={submit}>{busy?'Conectando…':register?'Crear cuenta  →':'Iniciar sesión  →'}</NeonButton>
 <Pressable accessibilityRole="link" style={s.switch} onPress={()=>router.replace(register?'/iniciar-sesion':'/registro')}><Text style={s.text}>{register?'¿Ya tienes una cuenta?':'¿Aún no tienes una cuenta?'} <Text style={s.link}>{register?'Iniciar sesión':'Crear cuenta'}</Text></Text></Pressable>
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#080511'},content:{padding:25,paddingBottom:45,flexGrow:1},back:{alignSelf:'flex-start',padding:8,zIndex:2},text:{color:'#eee0f9',fontSize:14},art:{height:210,overflow:'hidden',marginTop:-35,alignItems:'center'},brand:{alignItems:'center',marginTop:15,marginBottom:20},title:{color:'white',fontSize:32,fontWeight:'700',textAlign:'center'},subtitle:{color:'#cdbedb',textAlign:'center',fontSize:15,lineHeight:23,marginTop:8,marginBottom:28},input:{position:'relative',borderWidth:1,borderColor:'#785197',borderRadius:14,backgroundColor:'#160f24aa',color:'white',paddingHorizontal:16,minHeight:51,marginBottom:14,fontSize:14},password:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#785197',borderRadius:14,marginBottom:14,overflow:'hidden'},show:{padding:13},check:{flexDirection:'row',alignItems:'center',gap:9,minHeight:44,marginTop:4},box:{color:'#d94ff0',fontSize:26},link:{color:'#e184f4',textDecorationLine:'underline'},message:{color:'#f3a5dc',fontSize:13,lineHeight:19,marginBottom:13},switch:{alignItems:'center',paddingTop:30,paddingBottom:12},wave:{position:'absolute',width:500,height:160,borderRadius:250,borderWidth:2,borderColor:'#aa1dde',top:70,left:-70,transform:[{rotate:'-20deg'}],opacity:.35}});

const login=StyleSheet.create({
 content:{flexGrow:1,paddingBottom:25,backgroundColor:'#080511'},canvas:{width:'100%',maxWidth:480,alignSelf:'center'},
 hero:{width:'100%',overflow:'hidden'},back:{position:'absolute',left:14,width:44,height:44,alignItems:'center',justifyContent:'center'},chevron:{width:13,height:13,borderLeftWidth:2,borderBottomWidth:2,borderColor:'#fff',transform:[{rotate:'45deg'}]},
 form:{marginTop:-48},brand:{alignItems:'center',marginBottom:23},brandRow:{flexDirection:'row',gap:10,alignItems:'center'},brandMark:{width:40,height:42,borderRadius:12,flexDirection:'row',gap:3,alignItems:'center',justifyContent:'center'},brandName:{fontSize:26,color:'#fff',fontWeight:'700',letterSpacing:-1},title:{color:'#fff',fontSize:30,fontWeight:'700',textAlign:'center',letterSpacing:-.7},subtitle:{color:'#d1c2dd',fontSize:14,textAlign:'center',marginTop:8,marginBottom:25},
 field:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#795196',borderRadius:14,backgroundColor:'#140d22b3',minHeight:50,marginBottom:13,paddingLeft:14},input:{flex:1,minWidth:0,minHeight:48,color:'#f9f2ff',fontSize:13,paddingVertical:12,paddingHorizontal:12},
 icon:{width:21,height:23,alignItems:'center',justifyContent:'center'},envelope:{width:19,height:14,borderWidth:1.5,borderColor:'#e9bcfa',borderRadius:2,overflow:'hidden'},envelopeFlap:{width:12,height:12,borderRightWidth:1.5,borderBottomWidth:1.5,borderColor:'#e9bcfa',transform:[{translateY:-7},{rotate:'45deg'}],alignSelf:'center'},
 shackle:{width:10,height:10,borderWidth:1.5,borderColor:'#e9bcfa',borderTopLeftRadius:6,borderTopRightRadius:6,position:'absolute',top:1},lockBody:{width:16,height:13,borderWidth:1.5,borderColor:'#e9bcfa',borderRadius:3,position:'absolute',bottom:1,alignItems:'center',justifyContent:'center'},keyhole:{width:2,height:4,backgroundColor:'#e9bcfa',borderRadius:1},
 eyeButton:{width:46,minHeight:48,alignItems:'center',justifyContent:'center'},eye:{width:19,height:12,borderRadius:10,borderWidth:1.5,borderColor:'#ead3f8',alignItems:'center',justifyContent:'center'},pupil:{width:5,height:5,borderRadius:3,borderWidth:1.5,borderColor:'#ead3f8'},
 options:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5,marginTop:0,marginBottom:13},remember:{flexDirection:'row',alignItems:'center',gap:7,minHeight:44},checkbox:{width:18,height:18,borderRadius:4,borderWidth:1,borderColor:'#a66dd1',backgroundColor:'#160d25',alignItems:'center',justifyContent:'center'},checked:{backgroundColor:'#a52eec',borderColor:'#b445f5'},tick:{color:'white',fontWeight:'700',fontSize:13,lineHeight:16},rememberText:{color:'#f5eafa',fontSize:11},forgot:{minHeight:44,justifyContent:'center'},forgotText:{color:'#e58df7',fontSize:11,textDecorationLine:'underline'},
 message:{color:'#f3a5dc',fontSize:12,lineHeight:18,marginBottom:14},submit:{minHeight:52,borderRadius:28,overflow:'hidden',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:15},submitText:{color:'#fff',fontSize:15,fontWeight:'700'},arrow:{color:'#fff',fontSize:26,lineHeight:29},
 switch:{paddingTop:32,paddingBottom:14,minHeight:60,alignItems:'center'},switchText:{color:'#e7d9f1',fontSize:12,textAlign:'center',lineHeight:20},switchLink:{color:'#e58df7',textDecorationLine:'underline',fontWeight:'600'},
});
