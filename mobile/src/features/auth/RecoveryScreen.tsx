import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Brand, NeonButton } from '../../components/Neon';
import { request } from '../../services/auth';
export default function RecoveryScreen({ reset = false }: { reset?: boolean }) {
 const params = useLocalSearchParams<{ token?: string }>();
 const [email, setEmail] = useState(''); const [password,setPassword] = useState(''); const [confirm,setConfirm] = useState('');
 const [visible,setVisible]=useState(false); const [busy,setBusy]=useState(false); const [success,setSuccess]=useState(''); const [error,setError]=useState('');
 const token = typeof params.token === 'string' ? params.token : '';
 const invalid=reset && !/^[a-f0-9]{64}$/.test(token);
 async function submit() {
  setError('');
  if (reset && (password.length<8 || password.length>72)) return setError('La contraseña debe tener entre 8 y 72 caracteres.');
  if (reset && password!==confirm) return setError('Las contraseñas no coinciden.');
  if (!reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Introduce un correo válido.');
  setBusy(true);
  try { const result=await request<{message:string}>(reset?'reset-password':'forgot-password',reset?{token,password}:{email:email.trim()});setSuccess(result.message); }
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
 <Brand/><Text style={s.title}>{reset?'Nueva contraseña':'Recupera tu cuenta'}</Text><Text style={s.text}>{reset?'Elige una contraseña de al menos 8 caracteres.':'Introduce tu correo electrónico para solicitar un enlace de recuperación.'}</Text>
 {success ? <Text accessibilityLiveRegion="polite" style={s.success}>{success}</Text> : invalid ? <Text accessibilityRole="alert" style={s.error}>El enlace no es válido o está incompleto.</Text> : <View style={{gap:16}}>
 {reset ? <><TextInput style={s.input} accessibilityLabel="Nueva contraseña" placeholder="Nueva contraseña" placeholderTextColor="#bcaaca" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoComplete="new-password" maxLength={72} editable={!busy}/><TextInput style={s.input} accessibilityLabel="Confirmar nueva contraseña" placeholder="Confirmar nueva contraseña" placeholderTextColor="#bcaaca" value={confirm} onChangeText={setConfirm} secureTextEntry={!visible} autoCapitalize="none" autoComplete="new-password" maxLength={72} editable={!busy}/><Pressable accessibilityRole="button" onPress={()=>setVisible(!visible)}><Text style={s.link}>{visible?'Ocultar contraseñas':'Mostrar contraseñas'}</Text></Pressable></> : <TextInput style={s.input} accessibilityLabel="Correo electrónico" placeholder="Correo electrónico" placeholderTextColor="#bcaaca" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} editable={!busy}/>}
 <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text><NeonButton disabled={busy} onPress={submit}>{busy?'Procesando…':reset?'Guardar contraseña':'Enviar enlace'}</NeonButton></View>}
 {reset && !success && <Pressable accessibilityRole="link" onPress={()=>router.replace('/recuperar-contrasena')} style={s.nav}><Text style={s.link}>Solicitar otro enlace</Text></Pressable>}
 <Pressable accessibilityRole="link" onPress={()=>router.replace('/iniciar-sesion')} style={s.nav}><Text style={s.link}>← Volver a iniciar sesión</Text></Pressable>
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#080511'},content:{padding:28,paddingTop:70,paddingBottom:40,flexGrow:1,justifyContent:'center'},title:{color:'white',fontSize:30,fontWeight:'700',marginTop:35,marginBottom:12},text:{color:'#cdbedb',fontSize:15,lineHeight:23,marginBottom:28},input:{borderWidth:1,borderColor:'#785197',borderRadius:14,backgroundColor:'#160f24',color:'white',padding:16,minHeight:52},link:{color:'#e184f4',textDecorationLine:'underline',textAlign:'center'},nav:{paddingVertical:20,marginTop:10},error:{color:'#f3a5dc',lineHeight:21},success:{color:'#eed1ff',backgroundColor:'#321343',borderRadius:14,padding:18,lineHeight:24}});
